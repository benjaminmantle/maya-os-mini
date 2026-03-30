import { useState, useEffect, useRef, useCallback } from 'react';
import { useWhiteboardStore } from './hooks/useWhiteboardStore.js';
import {
  initBoards, createBoard, openBoard, closeBoard, deleteBoardById, renameBoard,
  setCamera, getCamera, getElements, getRenderStyle, setRenderStyle,
  addElement, updateElement, updateElements, deleteElements,
  applyUndo, applyRedo,
  bringForward, sendBackward, bringToFront, sendToBack,
  getGroups, setGroups,
} from './store/whiteboardStore.js';
import { setupCanvas } from './core/canvas.js';
import { zoomAtPoint, pan, screenToWorld, zoomToFit } from './core/camera.js';
import { TOOL_IDS } from './core/constants.js';
import { selectTool } from './tools/selectTool.js';
import { createShapeTool } from './tools/shapeTool.js';
import { createLineTool } from './tools/lineTool.js';
import { textTool, commitText, editExistingText } from './tools/textTool.js';
import { hitTest } from './elements/bounds.js';
import { cloneElement } from './elements/types.js';
import { groupElements, ungroupElements, expandSelectionToGroups } from './elements/groups.js';
import { undo, redo, clearHistory, pushCommand } from './core/history.js';
import { downloadPNG } from './core/exportImage.js';
import * as sketchStyle from './render/styles/sketchStyle.js';
import * as cleanStyle from './render/styles/cleanStyle.js';
import Toolbar from './components/Toolbar.jsx';
import StyleSwitcher from './components/StyleSwitcher.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import KeyboardHelp from './components/KeyboardHelp.jsx';
import s from './WhiteboardApp.module.css';

/* ---- clipboard (module-level) ---- */
let _clipboard = [];

/* ---- tool registry ---- */
const TOOLS = {
  [TOOL_IDS.SELECT]:   selectTool,
  [TOOL_IDS.RECT]:     createShapeTool(TOOL_IDS.RECT),
  [TOOL_IDS.ELLIPSE]:  createShapeTool(TOOL_IDS.ELLIPSE),
  [TOOL_IDS.LINE]:     createLineTool(TOOL_IDS.LINE),
  [TOOL_IDS.ARROW]:    createLineTool(TOOL_IDS.ARROW),
  [TOOL_IDS.FREEHAND]: createLineTool(TOOL_IDS.FREEHAND),
  [TOOL_IDS.TEXT]:     textTool,
};

export default function WhiteboardApp() {
  const { board, boards, ready } = useWhiteboardStore();

  useEffect(() => { initBoards(); }, []);

  if (!ready) return <div className={s.boardPicker}><p>Loading...</p></div>;
  if (!board) return <BoardPicker boards={boards} />;
  return <CanvasView board={board} />;
}

/* ---- Board Picker ---- */

function BoardPicker({ boards }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleNew = async () => {
    const id = await createBoard('Untitled Board');
    await openBoard(id);
  };

  const handleOpen = (id) => { if (editingId) return; openBoard(id); };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteBoardById(id);
  };

  const startRename = (e, b) => {
    e.stopPropagation();
    setEditingId(b.id);
    setEditName(b.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) renameBoard(editingId, editName.trim());
    setEditingId(null);
  };

  const fmtDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className={s.boardPicker}>
      <div className={s.bpTitle}>CosmiCanvas</div>
      {boards.length === 0 && (
        <div className={s.bpEmpty}>No boards yet. Create one to get started.</div>
      )}
      <ul className={s.bpList}>
        {boards.map(b => (
          <li key={b.id} className={s.bpItem} onClick={() => handleOpen(b.id)}>
            {editingId === b.id ? (
              <input
                className={s.bpNameInput}
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={s.bpName} onDoubleClick={(e) => startRename(e, b)}>{b.name}</span>
            )}
            <span className={s.bpDate}>{fmtDate(b.updatedAt)}</span>
            <button className={s.bpDelete} onClick={(e) => handleDelete(e, b.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button className={s.bpNew} onClick={handleNew}>
        + New Board
      </button>
    </div>
  );
}

/* ---- Canvas View ---- */

function CanvasView({ board }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const panState = useRef({ panning: false, lastX: 0, lastY: 0, spaceDown: false });

  const [activeTool, setActiveTool] = useState(TOOL_IDS.SELECT);
  const [defaultStroke, setDefaultStroke] = useState('#ddd9d6');
  const [defaultFill, setDefaultFill] = useState('transparent');
  const [defaultStrokeWidth, setDefaultStrokeWidth] = useState(2);
  const [selection, setSelection] = useState(new Set());
  const [hoveredId, setHoveredId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [textEditor, setTextEditor] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, elementIds }
  const [showHelp, setShowHelp] = useState(false);

  // mutable refs for the render loop getters
  const selRef = useRef(selection);
  const hovRef = useRef(hoveredId);
  const ghostRef = useRef(ghost);
  const marqueeRef = useRef(marquee);
  selRef.current = selection;
  hovRef.current = hoveredId;
  ghostRef.current = ghost;
  marqueeRef.current = marquee;

  const setDirty = useCallback(() => {
    if (engineRef.current) engineRef.current.setDirty();
  }, []);

  // set up canvas engine + register styles
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = setupCanvas(canvasRef.current);
    engineRef.current = engine;

    // register style renderers
    engine.renderer.registerStyle('sketch', sketchStyle);
    engine.renderer.registerStyle('clean', cleanStyle);

    engine.setGetters({
      elements:    () => getElements(),
      camera:      () => getCamera(),
      selection:   () => selRef.current,
      hoveredId:   () => hovRef.current,
      renderStyle: () => getRenderStyle(),
      ghost:       () => ghostRef.current,
      marquee:     () => marqueeRef.current,
    });

    clearHistory();
    return () => engine.destroy();
  }, []);

  // mark dirty when store changes
  useEffect(() => { setDirty(); });

  // build tool context
  const getToolCtx = useCallback(() => ({
    camera: getCamera(),
    elements: getElements(),
    selection,
    setSelection,
    setHoveredId,
    addElement,
    updateElement,
    updateElements,
    deleteElements,
    canvasEl: canvasRef.current,
    defaultStroke,
    defaultFill,
    defaultStrokeWidth,
    setDirty,
    setGhost,
    setMarquee,
    setActiveTool,
    openTextEditor: setTextEditor,
  }), [selection, setDirty, defaultStroke, defaultFill, defaultStrokeWidth]);

  /* ---- zoom (scroll wheel) ---- */
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const cam = getCamera();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const newCam = zoomAtPoint(cam, sx, sy, e.deltaY);
    setCamera(newCam);
    setDirty();
  }, [setDirty]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  /* ---- mouse events routed to active tool ---- */
  const handleMouseDown = useCallback((e) => {
    // skip if text editor is open (click outside dismisses via blur)
    if (textEditor) return;
    // pan takes priority
    const ps = panState.current;
    const isMiddle = e.button === 1;
    const isSpaceLeft = ps.spaceDown && e.button === 0;
    if (isMiddle || isSpaceLeft) {
      ps.panning = true;
      ps.lastX = e.clientX;
      ps.lastY = e.clientY;
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;
    const tool = TOOLS[activeTool];
    if (tool && tool.onMouseDown) tool.onMouseDown(getToolCtx(), e);
  }, [activeTool, getToolCtx, textEditor]);

  const handleMouseMove = useCallback((e) => {
    const ps = panState.current;
    if (ps.panning) {
      const dx = e.clientX - ps.lastX;
      const dy = e.clientY - ps.lastY;
      ps.lastX = e.clientX;
      ps.lastY = e.clientY;
      const cam = getCamera();
      setCamera(pan(cam, dx, dy));
      setDirty();
      return;
    }

    const tool = TOOLS[activeTool];
    if (tool && tool.onMouseMove) tool.onMouseMove(getToolCtx(), e);
  }, [activeTool, getToolCtx, setDirty]);

  const handleMouseUp = useCallback((e) => {
    const ps = panState.current;
    if (ps.panning) {
      ps.panning = false;
      return;
    }

    const tool = TOOLS[activeTool];
    if (tool && tool.onMouseUp) tool.onMouseUp(getToolCtx(), e);
  }, [activeTool, getToolCtx]);

  const handleDoubleClick = useCallback((e) => {
    // double-click on text element → edit
    const cam = getCamera();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, cam);
    const elements = getElements();
    const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    for (const el of sorted) {
      if (el.type === 'text' && hitTest(el, w.x, w.y, 4 / cam.zoom)) {
        editExistingText(getToolCtx(), el.id);
        return;
      }
    }
  }, [getToolCtx]);

  /* ---- undo/redo ---- */
  const handleUndo = useCallback(() => {
    const cmd = undo();
    if (cmd) { applyUndo(cmd); setDirty(); }
  }, [setDirty]);

  const handleRedo = useCallback(() => {
    const cmd = redo();
    if (cmd) { applyRedo(cmd); setDirty(); }
  }, [setDirty]);

  /* ---- clipboard / copy-paste ---- */
  const doCopy = useCallback(() => {
    const elements = getElements();
    _clipboard = [...selection].map(id => {
      const el = elements.find(e => e.id === id);
      return el ? JSON.parse(JSON.stringify(el)) : null;
    }).filter(Boolean);
  }, [selection]);

  const doPaste = useCallback(() => {
    if (_clipboard.length === 0) return;
    const newEls = _clipboard.map(snap => {
      const el = cloneElement(snap);
      el.x += 20; el.y += 20;
      return el;
    });
    const newSel = new Set();
    for (const el of newEls) {
      addElement(el);
      newSel.add(el.id);
    }
    pushCommand({
      type: 'create',
      elementIds: [...newSel],
      before: [],
      after: newEls.map(e => JSON.parse(JSON.stringify(e))),
    });
    setSelection(newSel);
    // update clipboard positions for next paste
    _clipboard = newEls.map(e => JSON.parse(JSON.stringify(e)));
    setDirty();
  }, [setDirty]);

  const doDuplicate = useCallback(() => {
    doCopy();
    doPaste();
  }, [doCopy, doPaste]);

  /* ---- groups ---- */
  const doGroup = useCallback(() => {
    if (selection.size < 2) return;
    const elements = getElements();
    const groups = getGroups();
    const gid = groupElements([...selection], elements, groups);
    setGroups(groups);
    pushCommand({ type: 'style', elementIds: [...selection],
      before: [...selection].map(id => ({ id, groupId: null })),
      after: [...selection].map(id => ({ id, groupId: gid })),
    });
    setDirty();
  }, [selection, setDirty]);

  const doUngroup = useCallback(() => {
    const elements = getElements();
    const groups = getGroups();
    const groupIds = new Set();
    for (const id of selection) {
      const el = elements.find(e => e.id === id);
      if (el && el.groupId) groupIds.add(el.groupId);
    }
    for (const gid of groupIds) {
      ungroupElements(gid, elements, groups);
    }
    setGroups(groups);
    setDirty();
  }, [selection, setDirty]);

  const canUngroup = (() => {
    const elements = getElements();
    for (const id of selection) {
      const el = elements.find(e => e.id === id);
      if (el && el.groupId) return true;
    }
    return false;
  })();

  /* ---- select all ---- */
  const doSelectAll = useCallback(() => {
    setSelection(new Set(getElements().map(e => e.id)));
    setDirty();
  }, [setDirty]);

  /* ---- zoom to fit ---- */
  const doZoomToFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const cam = zoomToFit(getElements(), parent.clientWidth, parent.clientHeight);
    setCamera(cam);
    setDirty();
  }, [setDirty]);

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    const onKeyDown = (e) => {
      // space for pan mode
      if (e.code === 'Space' && !e.repeat) {
        panState.current.spaceDown = true;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        return;
      }

      // don't capture if text editor is open
      if (textEditor) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
        if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); handleRedo(); return; }
        if (e.key === 'y')                { e.preventDefault(); handleRedo(); return; }
        if (e.key === 'c')                { e.preventDefault(); doCopy(); return; }
        if (e.key === 'v')                { e.preventDefault(); doPaste(); return; }
        if (e.key === 'd')                { e.preventDefault(); doDuplicate(); return; }
        if (e.key === 'a')                { e.preventDefault(); doSelectAll(); return; }
        if (e.key === 'e' && e.shiftKey)  {
          e.preventDefault();
          // Ctrl+Shift+E — export selection or full board
          const els = selection.size > 0
            ? getElements().filter(el => selection.has(el.id))
            : getElements();
          if (els.length) downloadPNG(els, getRenderStyle(), `${board.name || 'cosmicanvas'}.png`);
          return;
        }
        if (e.key === '0')               { e.preventDefault(); doZoomToFit(); return; }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const cam = getCamera();
          setCamera({ ...cam, zoom: Math.min(64, cam.zoom * 1.2) }); setDirty(); return;
        }
        if (e.key === '-') {
          e.preventDefault();
          const cam = getCamera();
          setCamera({ ...cam, zoom: Math.max(0.05, cam.zoom / 1.2) }); setDirty(); return;
        }
        if (e.key === '1') {
          e.preventDefault();
          const cam = getCamera(); setCamera({ ...cam, zoom: 1 }); setDirty(); return;
        }
        if (e.key === 'g' && !e.shiftKey) { e.preventDefault(); doGroup(); return; }
        if (e.key === 'g' && e.shiftKey)  { e.preventDefault(); doUngroup(); return; }
        if (e.key === ']')               { e.preventDefault(); bringToFront([...selection]); setDirty(); return; }
        if (e.key === '[')               { e.preventDefault(); sendToBack([...selection]); setDirty(); return; }
        return;
      }

      // tool shortcuts (only when no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const keyMap = { v: TOOL_IDS.SELECT, r: TOOL_IDS.RECT, e: TOOL_IDS.ELLIPSE,
          l: TOOL_IDS.LINE, a: TOOL_IDS.ARROW, d: TOOL_IDS.FREEHAND, t: TOOL_IDS.TEXT };
        const numMap = { '1': TOOL_IDS.SELECT, '2': TOOL_IDS.RECT, '3': TOOL_IDS.ELLIPSE,
          '4': TOOL_IDS.LINE, '5': TOOL_IDS.ARROW, '6': TOOL_IDS.FREEHAND, '7': TOOL_IDS.TEXT };
        const tool = keyMap[e.key.toLowerCase()] || numMap[e.key];
        if (tool) { setActiveTool(tool); return; }

        // Escape — clear everything
        if (e.key === 'Escape') {
          setContextMenu(null);
          setSelection(new Set());
          setMarquee(null);
          setGhost(null);
          setActiveTool(TOOL_IDS.SELECT);
          setDirty();
          return;
        }

        // Delete/Backspace → forward to select tool
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const tool = TOOLS[TOOL_IDS.SELECT];
          if (tool.onKeyDown) tool.onKeyDown(getToolCtx(), e);
          return;
        }

        // z-order (no modifier)
        if (e.key === ']') { bringForward([...selection]); setDirty(); return; }
        if (e.key === '[') { sendBackward([...selection]); setDirty(); return; }

        // help
        if (e.key === '?') { setShowHelp(h => !h); return; }
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        panState.current.spaceDown = false;
        panState.current.panning = false;
        if (canvasRef.current) {
          const tool = TOOLS[activeTool];
          canvasRef.current.style.cursor = tool?.cursor || 'default';
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeTool, textEditor, selection, handleUndo, handleRedo, getToolCtx, setDirty,
      doCopy, doPaste, doDuplicate, doSelectAll, doZoomToFit, doGroup, doUngroup]);

  /* ---- cursor ---- */
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!panState.current.spaceDown) {
      const tool = TOOLS[activeTool];
      canvasRef.current.style.cursor = tool?.cursor || 'default';
    }
  }, [activeTool]);

  /* ---- text editor overlay ---- */
  const handleTextCommit = useCallback((text) => {
    if (!textEditor) return;
    commitText(getToolCtx(), textEditor.elementId, text);
    setTextEditor(null);
  }, [textEditor, getToolCtx]);

  const handleTextCancel = useCallback(() => {
    if (!textEditor) return;
    if (textEditor.isNew) {
      // delete the empty element
      deleteElements([textEditor.elementId]);
      setDirty();
    }
    setTextEditor(null);
  }, [textEditor, setDirty]);

  const handleBack = () => { closeBoard(); clearHistory(); };

  const zoom = board.camera ? Math.round(board.camera.zoom * 100) : 100;
  const renderStyle = board.renderStyle || 'sketch';

  return (
    <div className={s.canvasWrap}>
      <canvas
        ref={canvasRef}
        className={s.canvasEl}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          const cam = getCamera();
          const rect = canvasRef.current.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const w = screenToWorld(sx, sy, cam);
          const elements = getElements();
          // hit test to find element under cursor
          const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
          let hitIds = [];
          for (const el of sorted) {
            if (hitTest(el, w.x, w.y, 4 / cam.zoom)) {
              // if element is in selection, use entire selection; otherwise just this element
              if (selection.has(el.id)) {
                hitIds = [...selection];
              } else {
                hitIds = [el.id];
                setSelection(new Set([el.id]));
              }
              break;
            }
          }
          setContextMenu({ x: e.clientX, y: e.clientY, elementIds: hitIds });
        }}
      />

      <button className={s.backBtn} onClick={handleBack}>←</button>
      <BoardTitle name={board.name} boardId={board.id} />
      <div className={s.zoomBadge}>{zoom}%</div>

      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        strokeColor={defaultStroke}
        fillColor={defaultFill}
        strokeWidth={defaultStrokeWidth}
        onStrokeChange={setDefaultStroke}
        onFillChange={setDefaultFill}
        onStrokeWidthChange={setDefaultStrokeWidth}
        onClearBoard={() => {
          const els = getElements();
          if (els.length === 0) return;
          pushCommand({
            type: 'delete',
            elementIds: els.map(e => e.id),
            before: els.map(e => JSON.parse(JSON.stringify(e))),
            after: [],
          });
          deleteElements(els.map(e => e.id));
          setSelection(new Set());
          setDirty();
        }}
      />

      <StyleSwitcher
        renderStyle={renderStyle}
        setRenderStyle={setRenderStyle}
      />

      {textEditor && (
        <TextEditorOverlay
          info={textEditor}
          onCommit={handleTextCommit}
          onCancel={handleTextCancel}
        />
      )}

      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          elementIds={contextMenu.elementIds}
          elements={getElements()}
          onClose={() => setContextMenu(null)}
          onStyleChange={(prop, value) => {
            for (const id of (contextMenu.elementIds || [])) {
              updateElement(id, { [prop]: value });
            }
            setDirty();
          }}
          onArrange={(dir) => {
            const ids = contextMenu.elementIds || [];
            if (dir === 'forward') bringForward(ids);
            else if (dir === 'backward') sendBackward(ids);
            else if (dir === 'front') bringToFront(ids);
            else if (dir === 'back') sendToBack(ids);
            setDirty();
          }}
          onGroup={doGroup}
          onUngroup={doUngroup}
          canUngroup={canUngroup}
          onDuplicate={() => { doCopy(); doPaste(); }}
          onCopy={doCopy}
          onPaste={doPaste}
          canPaste={_clipboard.length > 0}
          onDelete={() => {
            const ids = contextMenu.elementIds || [];
            if (ids.length === 0) return;
            const elements = getElements();
            const deleted = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
            pushCommand({
              type: 'delete', elementIds: ids,
              before: deleted.map(el => JSON.parse(JSON.stringify(el))),
              after: [],
            });
            deleteElements(ids);
            setSelection(new Set());
            setDirty();
          }}
          onSelectAll={doSelectAll}
          onZoomToFit={doZoomToFit}
          onExportSelection={() => {
            const ids = contextMenu.elementIds || [];
            const els = getElements().filter(e => ids.includes(e.id));
            if (els.length) downloadPNG(els, renderStyle, `cosmicanvas-selection.png`);
          }}
          onExportBoard={() => {
            const els = getElements();
            if (els.length) downloadPNG(els, renderStyle, `${board.name || 'cosmicanvas'}.png`);
          }}
        />
      )}
    </div>
  );
}

/* ---- Board Title (editable) ---- */

function BoardTitle({ name, boardId }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);

  const commit = () => {
    if (val.trim()) renameBoard(boardId, val.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className={s.boardTitleInput}
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
          e.stopPropagation();
        }}
      />
    );
  }

  return (
    <span className={s.boardTitle} onDoubleClick={() => { setVal(name); setEditing(true); }}>
      {name}
    </span>
  );
}

/* ---- Text Editor Overlay ---- */

function TextEditorOverlay({ info, onCommit, onCancel }) {
  const ref = useRef(null);
  const mounted = useRef(false);
  const committed = useRef(false);

  useEffect(() => {
    // delay focus slightly to avoid immediate blur from React re-render
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        if (info.text) ref.current.value = info.text;
        mounted.current = true;
      }
    }, 50);
    return () => clearTimeout(t);
  }, [info]);

  const doCommit = (text) => {
    if (committed.current) return;
    committed.current = true;
    onCommit(text);
  };

  const handleBlur = () => {
    // skip blur if we haven't fully mounted yet
    if (!mounted.current) return;
    doCommit(ref.current?.value || '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      committed.current = true;
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doCommit(ref.current?.value || '');
    }
    e.stopPropagation();
  };

  return (
    <textarea
      ref={ref}
      className={s.textOverlay}
      style={{
        left: info.screenX,
        top: info.screenY,
        fontSize: info.fontSize || 20,
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
