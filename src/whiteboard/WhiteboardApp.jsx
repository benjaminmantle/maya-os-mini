import { useState, useEffect, useRef, useCallback } from 'react';
import { useWhiteboardStore } from './hooks/useWhiteboardStore.js';
import {
  initBoards, createBoard, openBoard, closeBoard, deleteBoardById,
  setCamera, getCamera, getElements, getRenderStyle, setRenderStyle,
  addElement, updateElement, updateElements, deleteElements,
  applyUndo, applyRedo,
} from './store/whiteboardStore.js';
import { setupCanvas } from './core/canvas.js';
import { zoomAtPoint, pan, screenToWorld } from './core/camera.js';
import { TOOL_IDS } from './core/constants.js';
import { selectTool } from './tools/selectTool.js';
import { createShapeTool } from './tools/shapeTool.js';
import { createLineTool } from './tools/lineTool.js';
import { textTool, commitText, editExistingText } from './tools/textTool.js';
import { hitTest } from './elements/bounds.js';
import { undo, redo, clearHistory, canUndo, canRedo } from './core/history.js';
import * as sketchStyle from './render/styles/sketchStyle.js';
import * as cleanStyle from './render/styles/cleanStyle.js';
import Toolbar from './components/Toolbar.jsx';
import StyleSwitcher from './components/StyleSwitcher.jsx';
import s from './WhiteboardApp.module.css';

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
  const handleNew = async () => {
    const id = await createBoard('Untitled Board');
    await openBoard(id);
  };

  const handleOpen = (id) => openBoard(id);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteBoardById(id);
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
            <span className={s.bpName}>{b.name}</span>
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
  const [selection, setSelection] = useState(new Set());
  const [hoveredId, setHoveredId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [textEditor, setTextEditor] = useState(null);

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
    setDirty,
    setGhost,
    setMarquee,
    setActiveTool,
    openTextEditor: setTextEditor,
  }), [selection, setDirty]);

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
  }, [activeTool, getToolCtx]);

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

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
        if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); handleRedo(); return; }
        if (e.key === 'y')                { e.preventDefault(); handleRedo(); return; }
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

        // Escape
        if (e.key === 'Escape') {
          setSelection(new Set());
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
  }, [activeTool, textEditor, handleUndo, handleRedo, getToolCtx, setDirty]);

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
        onContextMenu={(e) => e.preventDefault()}
      />

      <button className={s.backBtn} onClick={handleBack}>← Boards</button>
      <div className={s.zoomBadge}>{zoom}%</div>

      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
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
    </div>
  );
}

/* ---- Text Editor Overlay ---- */

function TextEditorOverlay({ info, onCommit, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      if (info.text) ref.current.value = info.text;
    }
  }, [info]);

  const handleBlur = () => {
    onCommit(ref.current?.value || '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommit(ref.current?.value || '');
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
    />
  );
}
