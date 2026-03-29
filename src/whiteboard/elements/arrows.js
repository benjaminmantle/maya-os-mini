/* Arrow connection logic — connection points, snapping, path computation */

import { getBounds } from './bounds.js';

/** Get the 5 connection points on a shape element */
export function getConnectionPoints(el) {
  const b = getBounds(el);
  return {
    top:    { x: b.x + b.width / 2, y: b.y },
    right:  { x: b.x + b.width,     y: b.y + b.height / 2 },
    bottom: { x: b.x + b.width / 2, y: b.y + b.height },
    left:   { x: b.x,               y: b.y + b.height / 2 },
    center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  };
}

/** Find nearest connection point on a specific element */
export function nearestConnectionPoint(el, wx, wy) {
  const pts = getConnectionPoints(el);
  let best = null, bestDist = Infinity;
  for (const [position, pt] of Object.entries(pts)) {
    const d = Math.hypot(wx - pt.x, wy - pt.y);
    if (d < bestDist) { bestDist = d; best = { point: pt, position }; }
  }
  return best;
}

/**
 * Search all elements for a nearby connection point.
 * Returns { elementId, point, position, screenDist } or null.
 */
export function snapToConnection(elements, wx, wy, excludeId, threshold = 30) {
  let best = null, bestDist = Infinity;
  for (const el of elements) {
    if (el.id === excludeId) continue;
    // only snap to shapes with area
    if (!['rectangle', 'ellipse', 'image'].includes(el.type)) continue;
    const ncp = nearestConnectionPoint(el, wx, wy);
    if (!ncp) continue;
    const d = Math.hypot(wx - ncp.point.x, wy - ncp.point.y);
    if (d < threshold && d < bestDist) {
      bestDist = d;
      best = { elementId: el.id, point: ncp.point, position: ncp.position };
    }
  }
  return best;
}

/**
 * Compute the actual start/end coordinates for an arrow,
 * resolving any bindings to current element positions.
 */
export function computeArrowPath(arrow, elements) {
  const pts = arrow.points || [];
  if (pts.length < 2) return pts.map(p => ({ x: arrow.x + p.x, y: arrow.y + p.y }));

  const result = pts.map(p => ({ x: arrow.x + p.x, y: arrow.y + p.y }));

  // resolve start binding
  if (arrow.startBinding) {
    const target = elements.find(e => e.id === arrow.startBinding.elementId);
    if (target) {
      const cp = getConnectionPoints(target);
      const pt = cp[arrow.startBinding.point] || cp.center;
      result[0] = { x: pt.x, y: pt.y };
    }
  }

  // resolve end binding
  if (arrow.endBinding) {
    const target = elements.find(e => e.id === arrow.endBinding.elementId);
    if (target) {
      const cp = getConnectionPoints(target);
      const pt = cp[arrow.endBinding.point] || cp.center;
      result[result.length - 1] = { x: pt.x, y: pt.y };
    }
  }

  return result;
}
