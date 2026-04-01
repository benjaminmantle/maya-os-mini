/* Snap-to-grid logic + alignment guides */

import { getBounds } from '../elements/bounds.js';

const GRID_SIZE = 20; // matches dot grid spacing

/**
 * Snap a value to the nearest grid point.
 */
export function snapToGrid(val, gridSize = GRID_SIZE) {
  return Math.round(val / gridSize) * gridSize;
}

/**
 * Snap a point { x, y } to the grid.
 */
export function snapPoint(x, y, gridSize = GRID_SIZE) {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Snap element dimensions (width, height) to grid.
 */
export function snapSize(w, h, gridSize = GRID_SIZE) {
  return {
    w: Math.max(gridSize, snapToGrid(w, gridSize)),
    h: Math.max(gridSize, snapToGrid(h, gridSize)),
  };
}

/* ---- Alignment guides ---- */

/** Compute composite bounding box for a set of elements */
function compositeBounds(elements, ids) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    if (!ids.has(el.id)) continue;
    const b = getBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Extract 6 alignment edges from a bounding box */
function edges(b) {
  return {
    left:    b.x,
    centerX: b.x + b.width / 2,
    right:   b.x + b.width,
    top:     b.y,
    centerY: b.y + b.height / 2,
    bottom:  b.y + b.height,
  };
}

/**
 * Compute alignment guides for dragged elements.
 * @param {Object} dragBounds - bounding box of dragged selection at proposed position
 * @param {Array}  allElements - all elements on the board
 * @param {Set}    selection - IDs of dragged elements (excluded from targets)
 * @param {number} tolerance - snap distance in world pixels
 * @returns {{ snapDx: number, snapDy: number, guides: Array }}
 */
export function computeAlignmentGuides(dragBounds, allElements, selection, tolerance) {
  const de = edges(dragBounds);
  const dragXEdges = [de.left, de.centerX, de.right];
  const dragYEdges = [de.top, de.centerY, de.bottom];

  let bestDx = null, bestAbsDx = tolerance + 1;
  let bestDy = null, bestAbsDy = tolerance + 1;
  const xMatches = []; // { dragVal, targetVal, targetBounds }
  const yMatches = [];

  for (const el of allElements) {
    if (selection.has(el.id)) continue;
    const b = getBounds(el);
    const te = edges(b);
    const targetXEdges = [te.left, te.centerX, te.right];
    const targetYEdges = [te.top, te.centerY, te.bottom];

    for (const dv of dragXEdges) {
      for (const tv of targetXEdges) {
        const diff = tv - dv;
        const absDiff = Math.abs(diff);
        if (absDiff <= tolerance) {
          if (absDiff < bestAbsDx) { bestAbsDx = absDiff; bestDx = diff; }
          xMatches.push({ pos: tv, tBounds: b });
        }
      }
    }
    for (const dv of dragYEdges) {
      for (const tv of targetYEdges) {
        const diff = tv - dv;
        const absDiff = Math.abs(diff);
        if (absDiff <= tolerance) {
          if (absDiff < bestAbsDy) { bestAbsDy = absDiff; bestDy = diff; }
          yMatches.push({ pos: tv, tBounds: b });
        }
      }
    }
  }

  const snapDx = bestDx ?? 0;
  const snapDy = bestDy ?? 0;
  const guides = [];

  // Build vertical guide lines (x-axis alignment)
  if (bestDx !== null) {
    const snappedBounds = { ...dragBounds, x: dragBounds.x + snapDx };
    for (const m of xMatches) {
      if (Math.abs(m.pos - (m.pos)) > tolerance) continue; // filter to best snap
      const minY = Math.min(snappedBounds.y, m.tBounds.y) - 10;
      const maxY = Math.max(snappedBounds.y + snappedBounds.height, m.tBounds.y + m.tBounds.height) + 10;
      guides.push({ axis: 'x', pos: m.pos, from: minY, to: maxY });
    }
  }

  // Build horizontal guide lines (y-axis alignment)
  if (bestDy !== null) {
    const snappedBounds = { ...dragBounds, y: dragBounds.y + snapDy };
    for (const m of yMatches) {
      const minX = Math.min(snappedBounds.x + snapDx, m.tBounds.x) - 10;
      const maxX = Math.max(snappedBounds.x + snapDx + snappedBounds.width, m.tBounds.x + m.tBounds.width) + 10;
      guides.push({ axis: 'y', pos: m.pos, from: minX, to: maxX });
    }
  }

  // Deduplicate guides at same position
  const seen = new Set();
  const uniqueGuides = guides.filter(g => {
    const key = `${g.axis}:${g.pos.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { snapDx, snapDy, guides: uniqueGuides };
}

/** Compute composite bounds for selection at a proposed offset */
export function getSelectionBounds(elements, selection, dx, dy) {
  const cb = compositeBounds(elements, selection);
  if (!cb) return null;
  return { x: cb.x + dx, y: cb.y + dy, width: cb.width, height: cb.height };
}
