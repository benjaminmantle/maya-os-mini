/* Select tool — click to select, drag to move, handles to resize, marquee */

import { hitTest, hitTestHandle, getBounds, containedInRect } from '../elements/bounds.js';
import { screenToWorld } from '../core/camera.js';
import { pushCommand } from '../core/history.js';
import { snapToGrid, computeAlignmentGuides, getSelectionBounds } from '../core/snap.js';

/** Resize snapshot uses getBounds so handles align with what user sees */
function _resizeSnapshot(el) {
  const b = getBounds(el);
  const snap = JSON.parse(JSON.stringify(el));
  snap._bounds = b; // stash computed bounds for resize math
  return snap;
}

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
          resizeSnap = { id: el.id, before: _resizeSnapshot(el) };
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

    if (mode === 'dragging' && dragStart && dragSnap) {
      let dx = w.x - dragStart.x;
      let dy = w.y - dragStart.y;

      // Alignment guides: snap to other elements' edges/centers
      const tolerance = 5 / camera.zoom;
      const proposedBounds = getSelectionBounds(elements, selection, dx, dy);
      let alignResult = null;
      if (proposedBounds) {
        alignResult = computeAlignmentGuides(proposedBounds, elements, selection, tolerance);
      }

      if (alignResult && (alignResult.snapDx !== 0 || alignResult.snapDy !== 0)) {
        // Alignment snap takes priority
        dx += alignResult.snapDx;
        dy += alignResult.snapDy;
        if (ctx.setGuides) ctx.setGuides(alignResult.guides);
      } else if (ctx.snapEnabled && dragSnap.length > 0) {
        // Fall back to grid snap
        const first = dragSnap[0].before;
        dx = snapToGrid(first.x + dx) - first.x;
        dy = snapToGrid(first.y + dy) - first.y;
        if (ctx.setGuides) ctx.setGuides(null);
      } else {
        if (ctx.setGuides) ctx.setGuides(null);
      }

      const patches = dragSnap.map(snap => ({
        id: snap.id,
        x: snap.before.x + dx,
        y: snap.before.y + dy,
      }));
      if (patches.length) {
        // silent update: mutates store without React notify (avoids re-render per mousemove)
        if (ctx.updateElementsSilent) {
          ctx.updateElementsSilent(patches);
        } else {
          updateElements(patches);
        }
        setDirty();
      }
      return;
    }

    if (mode === 'resizing' && resizeSnap && dragStart) {
      const el = elements.find(ee => ee.id === resizeSnap.id);
      if (!el) return;
      const before = resizeSnap.before;
      const patch = _applyResize(el, before, resizeHandle, w, dragStart, e.shiftKey);
      ctx.updateElement(el.id, patch);
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

    // hover detection — use spatial index when available for O(log n) candidate lookup
    if (mode === 'idle') {
      let found = null;
      const pad = 4 / camera.zoom;
      if (ctx.spatialIdx) {
        const candidates = ctx.spatialIdx.queryPoint(w.x, w.y);
        if (candidates.length > 0) {
          candidates.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
          const el = candidates.find(c => hitTest(c, w.x, w.y, pad));
          found = el ? el.id : null;
        }
      } else {
        const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
        for (const el of sorted) {
          if (hitTest(el, w.x, w.y, pad)) { found = el.id; break; }
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
          elementIds: dragSnap.map(s => s.id),
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

    if (ctx.setGuides) ctx.setGuides(null);
    // sync React state after silent drag updates
    if (ctx.syncNotify) ctx.syncNotify();
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

/** Returns a patch object to apply to the element */
function _applyResize(el, before, handle, world, start, shift) {
  const dx = world.x - start.x;
  const dy = world.y - start.y;

  // Use computed bounds for point-based elements
  const b = before._bounds || { x: before.x, y: before.y, width: before.width || 1, height: before.height || 1 };
  let nx = b.x, ny = b.y;
  let nw = b.width || 1, nh = b.height || 1;

  if (handle.includes('e')) nw = Math.max(5, b.width + dx);
  if (handle.includes('w')) { nx = b.x + dx; nw = Math.max(5, b.width - dx); }
  if (handle.includes('s')) nh = Math.max(5, b.height + dy);
  if (handle.includes('n')) { ny = b.y + dy; nh = Math.max(5, b.height - dy); }

  if (shift) {
    const ratio = (b.width || 1) / (b.height || 1);
    if (nw / nh > ratio) nh = nw / ratio;
    else nw = nh * ratio;
  }

  const patch = { x: nx, y: ny, width: nw, height: nh };

  // Scale points for point-based elements
  if (before.points && before.points.length > 0) {
    const scaleX = nw / (b.width || 1);
    const scaleY = nh / (b.height || 1);
    // Points are relative to el.x, el.y. We need to offset them
    // since bounds.x/y may differ from el.x/el.y for lines drawn leftward
    const offsetX = b.x - before.x;
    const offsetY = b.y - before.y;
    patch.points = before.points.map(p => ({
      x: (p.x - offsetX) * scaleX + (nx - before.x),
      y: (p.y - offsetY) * scaleY + (ny - before.y),
    }));
    // Recalculate x to be the new origin
    patch.x = before.x;
    patch.y = before.y;
  }

  return patch;
}
