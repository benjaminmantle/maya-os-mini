/* Camera (pan/zoom) — pure functions, no state */

import { ZOOM_MIN, ZOOM_MAX } from './constants.js';

export function screenToWorld(sx, sy, cam) {
  return {
    x: (sx - cam.x) / cam.zoom,
    y: (sy - cam.y) / cam.zoom,
  };
}

export function worldToScreen(wx, wy, cam) {
  return {
    x: wx * cam.zoom + cam.x,
    y: wy * cam.zoom + cam.y,
  };
}

/** Return new camera zoomed at screen point (sx, sy) */
export function zoomAtPoint(cam, sx, sy, delta) {
  const factor = delta > 0 ? 0.9 : 1.1;
  let newZoom = cam.zoom * factor;
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  const scale = newZoom / cam.zoom;
  return {
    x: sx - (sx - cam.x) * scale,
    y: sy - (sy - cam.y) * scale,
    zoom: newZoom,
  };
}

export function pan(cam, dx, dy) {
  return { x: cam.x + dx, y: cam.y + dy, zoom: cam.zoom };
}

/** Compute camera to frame all elements with padding */
export function zoomToFit(elements, canvasW, canvasH, padding = 40) {
  if (!elements || elements.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const ex = el.x ?? 0;
    const ey = el.y ?? 0;
    const ew = el.width ?? 0;
    const eh = el.height ?? 0;
    if (el.points && el.points.length) {
      for (const p of el.points) {
        minX = Math.min(minX, ex + p.x);
        minY = Math.min(minY, ey + p.y);
        maxX = Math.max(maxX, ex + p.x);
        maxY = Math.max(maxY, ey + p.y);
      }
    } else {
      minX = Math.min(minX, ex);
      minY = Math.min(minY, ey);
      maxX = Math.max(maxX, ex + ew);
      maxY = Math.max(maxY, ey + eh);
    }
  }
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const zoom = Math.min(
    (canvasW - padding * 2) / contentW,
    (canvasH - padding * 2) / contentH,
    1,
  );
  const cx = (canvasW - contentW * zoom) / 2 - minX * zoom;
  const cy = (canvasH - contentH * zoom) / 2 - minY * zoom;
  return { x: cx, y: cy, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) };
}
