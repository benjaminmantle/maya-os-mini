/* Bounding box calculations and hit-testing */

/** Axis-aligned bounding box */
export function getBounds(el) {
  if (el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return {
      x: el.x + minX,
      y: el.y + minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    };
  }
  return {
    x: el.x,
    y: el.y,
    width: el.width || 1,
    height: el.height || 1,
  };
}

/** Is world point inside element? */
export function hitTest(el, wx, wy, tolerance = 4) {
  const t = el.type;

  if (t === 'rectangle' || t === 'text' || t === 'image') {
    return _pointInRect(wx, wy, el.x, el.y, el.width, el.height, tolerance);
  }

  if (t === 'ellipse') {
    return _pointInEllipse(wx, wy, el.x, el.y, el.width, el.height, tolerance);
  }

  if (t === 'line' || t === 'arrow') {
    if (!el.points || el.points.length < 2) return false;
    for (let i = 0; i < el.points.length - 1; i++) {
      const a = el.points[i];
      const b = el.points[i + 1];
      const d = _distToSegment(
        wx, wy,
        el.x + a.x, el.y + a.y,
        el.x + b.x, el.y + b.y,
      );
      if (d < tolerance + (el.strokeWidth || 2)) return true;
    }
    return false;
  }

  if (t === 'freehand') {
    if (!el.points || el.points.length < 2) return false;
    for (let i = 0; i < el.points.length - 1; i++) {
      const a = el.points[i];
      const b = el.points[i + 1];
      const d = _distToSegment(
        wx, wy,
        el.x + a.x, el.y + a.y,
        el.x + b.x, el.y + b.y,
      );
      if (d < tolerance + (el.strokeWidth || 2) + 2) return true;
    }
    return false;
  }

  // fallback: bounding box
  const bb = getBounds(el);
  return _pointInRect(wx, wy, bb.x, bb.y, bb.width, bb.height, tolerance);
}

/** Returns handle id or null. Handles are 8 compass points. */
export function hitTestHandle(el, wx, wy, camera) {
  const hs = 8 / camera.zoom; // handle size in world coords
  const handles = getHandles(el);
  const names = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  for (let i = 0; i < handles.length; i++) {
    const [hx, hy] = handles[i];
    if (Math.abs(wx - hx) <= hs && Math.abs(wy - hy) <= hs) {
      return names[i];
    }
  }
  return null;
}

/** 8 handle positions [x,y] in world coords */
export function getHandles(el) {
  const b = getBounds(el);
  const x = b.x, y = b.y, w = b.width, h = b.height;
  return [
    [x, y],             // NW
    [x + w / 2, y],     // N
    [x + w, y],         // NE
    [x + w, y + h / 2], // E
    [x + w, y + h],     // SE
    [x + w / 2, y + h], // S
    [x, y + h],         // SW
    [x, y + h / 2],     // W
  ];
}

/** Is element fully inside rect? */
export function containedInRect(el, rect) {
  const b = getBounds(el);
  return (
    b.x >= rect.x &&
    b.y >= rect.y &&
    b.x + b.width <= rect.x + rect.width &&
    b.y + b.height <= rect.y + rect.height
  );
}

/* ---- private helpers ---- */

function _pointInRect(px, py, rx, ry, rw, rh, tol) {
  return px >= rx - tol && px <= rx + rw + tol &&
         py >= ry - tol && py <= ry + rh + tol;
}

function _pointInEllipse(px, py, ex, ey, ew, eh, tol) {
  const cx = ex + ew / 2;
  const cy = ey + eh / 2;
  const rx = ew / 2 + tol;
  const ry = eh / 2 + tol;
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return (dx * dx + dy * dy) <= 1;
}

function _distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
