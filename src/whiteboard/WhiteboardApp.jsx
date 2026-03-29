import { useEffect, useRef, useCallback } from 'react';
import { useWhiteboardStore } from './hooks/useWhiteboardStore.js';
import {
  initBoards, createBoard, openBoard, closeBoard, deleteBoardById,
  setCamera, getCamera, getElements, getRenderStyle,
} from './store/whiteboardStore.js';
import { setupCanvas } from './core/canvas.js';
import { zoomAtPoint, pan } from './core/camera.js';
import s from './WhiteboardApp.module.css';

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

  // set up canvas engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = setupCanvas(canvasRef.current);
    engineRef.current = engine;

    engine.setGetters({
      elements:    () => getElements(),
      camera:      () => getCamera(),
      selection:   () => new Set(),
      hoveredId:   () => null,
      renderStyle: () => getRenderStyle(),
      ghost:       () => null,
      marquee:     () => null,
    });

    return () => engine.destroy();
  }, []);

  // mark dirty when store changes
  useEffect(() => {
    if (engineRef.current) engineRef.current.setDirty();
  });

  /* ---- zoom (scroll wheel) ---- */
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const cam = getCamera();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const newCam = zoomAtPoint(cam, sx, sy, e.deltaY);
    setCamera(newCam);
    if (engineRef.current) engineRef.current.setDirty();
  }, []);

  // attach wheel with passive: false
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  /* ---- pan (middle-click or space+left-click) ---- */
  const handleMouseDown = useCallback((e) => {
    const ps = panState.current;
    const isMiddle = e.button === 1;
    const isSpaceLeft = ps.spaceDown && e.button === 0;
    if (isMiddle || isSpaceLeft) {
      ps.panning = true;
      ps.lastX = e.clientX;
      ps.lastY = e.clientY;
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    const ps = panState.current;
    if (!ps.panning) return;
    const dx = e.clientX - ps.lastX;
    const dy = e.clientY - ps.lastY;
    ps.lastX = e.clientX;
    ps.lastY = e.clientY;
    const cam = getCamera();
    setCamera(pan(cam, dx, dy));
    if (engineRef.current) engineRef.current.setDirty();
  }, []);

  const handleMouseUp = useCallback(() => {
    panState.current.panning = false;
  }, []);

  /* ---- space key for pan mode ---- */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        panState.current.spaceDown = true;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        panState.current.spaceDown = false;
        panState.current.panning = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleBack = () => closeBoard();

  const zoom = board.camera ? Math.round(board.camera.zoom * 100) : 100;

  return (
    <div className={s.canvasWrap}>
      <canvas
        ref={canvasRef}
        className={s.canvasEl}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <button className={s.backBtn} onClick={handleBack}>← Boards</button>
      <div className={s.zoomBadge}>{zoom}%</div>
    </div>
  );
}
