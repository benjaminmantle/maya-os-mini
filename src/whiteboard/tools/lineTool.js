/* Line + freehand tool */

import { createLine, createArrow, createFreehand } from '../elements/types.js';
import { screenToWorld } from '../core/camera.js';
import { pushCommand } from '../core/history.js';
import { TOOL_IDS } from '../core/constants.js';

let startWorld = null;
let ghost = null;
let freehandPoints = null;

export function createLineTool(toolType) {
  const isFreehand = toolType === TOOL_IDS.FREEHAND;
  const isArrow = toolType === TOOL_IDS.ARROW;

  return {
    cursor: 'crosshair',

    onMouseDown(ctx, e) {
      const { camera, canvasEl } = ctx;
      const rect = canvasEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      startWorld = screenToWorld(sx, sy, camera);

      const sty = { strokeColor: ctx.defaultStroke || '#ddd9d6' };
      if (isFreehand) {
        freehandPoints = [{ x: 0, y: 0 }];
        ghost = createFreehand(startWorld.x, startWorld.y, freehandPoints, sty);
      } else if (isArrow) {
        ghost = createArrow(startWorld.x, startWorld.y, [
          { x: 0, y: 0 }, { x: 0, y: 0 },
        ], sty);
      } else {
        ghost = createLine(startWorld.x, startWorld.y, [
          { x: 0, y: 0 }, { x: 0, y: 0 },
        ], sty);
      }

      ctx.setGhost(ghost);
      ctx.setDirty();
    },

    onMouseMove(ctx, e) {
      if (!startWorld || !ghost) return;
      const { camera, canvasEl } = ctx;
      const rect = canvasEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy, camera);

      if (isFreehand) {
        const px = w.x - startWorld.x;
        const py = w.y - startWorld.y;
        freehandPoints.push({ x: px, y: py });
        ghost.points = freehandPoints;
      } else {
        let endX = w.x - startWorld.x;
        let endY = w.y - startWorld.y;

        // Shift = snap to 45-degree angles
        if (e.shiftKey) {
          const angle = Math.atan2(endY, endX);
          const len = Math.hypot(endX, endY);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          endX = Math.cos(snapped) * len;
          endY = Math.sin(snapped) * len;
        }

        ghost.points = [{ x: 0, y: 0 }, { x: endX, y: endY }];
      }

      ctx.setGhost(ghost);
      ctx.setDirty();
    },

    onMouseUp(ctx, e) {
      if (!ghost) return;
      ctx.setGhost(null);

      if (isFreehand) {
        // simplify points
        ghost.points = _simplify(freehandPoints, 2);
      }

      // discard trivial (too small)
      const pts = ghost.points;
      if (pts.length < 2) {
        _reset(ctx);
        return;
      }
      const dx = pts[pts.length - 1].x - pts[0].x;
      const dy = pts[pts.length - 1].y - pts[0].y;
      if (!isFreehand && Math.hypot(dx, dy) < 5) {
        _reset(ctx);
        return;
      }

      // compute width/height from points for bounding
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      ghost.width = maxX - minX || 1;
      ghost.height = maxY - minY || 1;

      ctx.addElement(ghost);
      pushCommand({
        type: 'create',
        elementIds: [ghost.id],
        before: [],
        after: [JSON.parse(JSON.stringify(ghost))],
      });

      ctx.setSelection(new Set());
      ctx.setDirty();

      startWorld = null;
      ghost = null;
      freehandPoints = null;
    },
  };
}

function _reset(ctx) {
  startWorld = null;
  ghost = null;
  freehandPoints = null;
  ctx.setDirty();
}

/* Ramer-Douglas-Peucker simplification */
function _simplify(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = _perpDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left = _simplify(points.slice(0, maxIdx + 1), epsilon);
    const right = _simplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function _perpDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
