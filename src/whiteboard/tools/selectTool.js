/* Select tool — click to select, drag to move, handles to resize, marquee */

import { hitTest, hitTestHandle, getBounds, containedInRect } from '../elements/bounds.js';
import { screenToWorld } from '../core/camera.js';
import { pushCommand } from '../core/history.js';

// internal state
let mode = 'idle'; // idle | dragging | resizing | marquee
let dragStart = null;
let dragSnap = null;   // snapshot of elements for undo
let resizeHandle = null;
let resizeSnap = null;
let marqueeStart = null;

export const selectTool = {
  cursor: 'default',

  onMouseDown(ctx, e) {
    const { camera, elements, selection, setSelection, canvasEl } = ctx;
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, camera);

    // check handles on selected elements first
    if (selection.size > 0) {
      for (const id of selection) {
        const el = elements.find(ee => ee.id === id);
        if (!el) continue;
        const handle = hitTestHandle(el, w.x, w.y, camera);
        if (handle) {
          mode = 'resizing';
          resizeHandle = handle;
          resizeSnap = { id: el.id, before: JSON.parse(JSON.stringify(el)) };
          dragStart = w;
          return;
        }
      }
    }

    // hit test elements (reverse z-order — topmost first)
    const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    for (const el of sorted) {
      if (hitTest(el, w.x, w.y, 4 / camera.zoom)) {
        if (e.shiftKey) {
          // toggle selection
          const newSel = new Set(selection);
          if (newSel.has(el.id)) newSel.delete(el.id);
          else newSel.add(el.id);
          setSelection(newSel);
        } else if (!selection.has(el.id)) {
          setSelection(new Set([el.id]));
        }
        // start drag
        mode = 'dragging';
        dragStart = w;
        // snapshot all selected for undo
        const sel = selection.has(el.id) ? selection : new Set([el.id]);
        dragSnap = [...sel].map(id => {
          const ee = elements.find(e2 => e2.id === id);
          return ee ? { id, before: { x: ee.x, y: ee.y } } : null;
        }).filter(Boolean);
        return;
      }
    }

    // empty click — start marquee or deselect
    if (!e.shiftKey) setSelection(new Set());
    mode = 'marquee';
    marqueeStart = { sx, sy, wx: w.x, wy: w.y };
    ctx.setMarquee({ x: sx, y: sy, w: 0, h: 0 });
  },

  onMouseMove(ctx, e) {
    const { camera, elements, selection, updateElements, canvasEl, setDirty, setHoveredId } = ctx;
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, camera);

    if (mode === 'dragging' && dragStart) {
      const dx = w.x - dragStart.x;
      const dy = w.y - dragStart.y;
      const patches = [];
      for (const id of selection) {
        const el = elements.find(ee => ee.id === id);
        if (!el) continue;
        const snap = dragSnap.find(s => s.id === id);
        if (snap) {
          patches.push({ id, x: snap.before.x + dx, y: snap.before.y + dy });
        }
      }
      if (patches.length) {
        updateElements(patches);
        setDirty();
      }
      return;
    }

    if (mode === 'resizing' && resizeSnap && dragStart) {
      const el = elements.find(ee => ee.id === resizeSnap.id);
      if (!el) return;
      const before = resizeSnap.before;
      _applyResize(el, before, resizeHandle, w, dragStart, e.shiftKey);
      ctx.updateElement(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      setDirty();
      return;
    }

    if (mode === 'marquee' && marqueeStart) {
      const mx = Math.min(marqueeStart.sx, sx);
      const my = Math.min(marqueeStart.sy, sy);
      const mw = Math.abs(sx - marqueeStart.sx);
      const mh = Math.abs(sy - marqueeStart.sy);
      ctx.setMarquee({ x: mx, y: my, w: mw, h: mh });

      // select elements inside marquee (world coords)
      const wx1 = Math.min(marqueeStart.wx, w.x);
      const wy1 = Math.min(marqueeStart.wy, w.y);
      const ww = Math.abs(w.x - marqueeStart.wx);
      const wh = Math.abs(w.y - marqueeStart.wy);
      const mRect = { x: wx1, y: wy1, width: ww, height: wh };
      const newSel = new Set();
      for (const el of elements) {
        if (containedInRect(el, mRect)) newSel.add(el.id);
      }
      ctx.setSelection(newSel);
      setDirty();
      return;
    }

    // hover detection
    if (mode === 'idle') {
      const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
      let found = null;
      for (const el of sorted) {
        if (hitTest(el, w.x, w.y, 4 / camera.zoom)) {
          found = el.id;
          break;
        }
      }
      setHoveredId(found);
      setDirty();
    }
  },

  onMouseUp(ctx, e) {
    if (mode === 'dragging' && dragSnap && dragStart) {
      const { elements, selection } = ctx;
      // push undo if actually moved
      const afterSnaps = dragSnap.map(s => {
        const el = elements.find(ee => ee.id === s.id);
        return el ? { id: s.id, after: { x: el.x, y: el.y } } : null;
      }).filter(Boolean);
      const moved = afterSnaps.some((a, i) =>
        a.after.x !== dragSnap[i].before.x || a.after.y !== dragSnap[i].before.y
      );
      if (moved) {
        pushCommand({
          type: 'move',
          elementIds: [...selection],
          before: dragSnap.map(s => ({ id: s.id, ...s.before })),
          after: afterSnaps.map(a => ({ id: a.id, ...a.after })),
        });
      }
    }

    if (mode === 'resizing' && resizeSnap) {
      const el = ctx.elements.find(ee => ee.id === resizeSnap.id);
      if (el) {
        pushCommand({
          type: 'resize',
          elementIds: [el.id],
          before: [resizeSnap.before],
          after: [JSON.parse(JSON.stringify(el))],
        });
      }
    }

    if (mode === 'marquee') {
      ctx.setMarquee(null);
    }

    mode = 'idle';
    dragStart = null;
    dragSnap = null;
    resizeHandle = null;
    resizeSnap = null;
    marqueeStart = null;
  },

  onKeyDown(ctx, e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const { selection, elements, deleteElements, setSelection, setDirty } = ctx;
      if (selection.size === 0) return;
      const deleted = [...selection].map(id => elements.find(ee => ee.id === id)).filter(Boolean);
      pushCommand({
        type: 'delete',
        elementIds: [...selection],
        before: deleted.map(el => JSON.parse(JSON.stringify(el))),
        after: [],
      });
      deleteElements([...selection]);
      setSelection(new Set());
      setDirty();
    }
  },
};

function _applyResize(el, before, handle, world, start, shift) {
  const dx = world.x - start.x;
  const dy = world.y - start.y;
  let nx = before.x, ny = before.y;
  let nw = before.width || 1, nh = before.height || 1;

  if (handle.includes('e')) nw = Math.max(5, (before.width || 1) + dx);
  if (handle.includes('w')) { nx = before.x + dx; nw = Math.max(5, (before.width || 1) - dx); }
  if (handle.includes('s')) nh = Math.max(5, (before.height || 1) + dy);
  if (handle.includes('n')) { ny = before.y + dy; nh = Math.max(5, (before.height || 1) - dy); }

  if (shift) {
    const ratio = (before.width || 1) / (before.height || 1);
    if (nw / nh > ratio) nh = nw / ratio;
    else nw = nh * ratio;
  }

  el.x = nx; el.y = ny; el.width = nw; el.height = nh;
}
