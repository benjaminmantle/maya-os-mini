/* Render orchestrator — delegates to active style renderer */

import { screenToWorld } from '../core/camera.js';
import { getBounds } from '../elements/bounds.js';
import { loadBlob } from '../store/idb.js';

/* ---- Image bitmap cache ---- */
const _imgCache = new Map(); // blobKey → ImageBitmap | 'loading' | null
let _dirtyCallback = null;

export function setImageDirtyCallback(fn) { _dirtyCallback = fn; }

async function _ensureImage(blobKey) {
  if (!blobKey || _imgCache.has(blobKey)) return;
  _imgCache.set(blobKey, 'loading');
  try {
    const rec = await loadBlob(blobKey);
    if (!rec) { _imgCache.set(blobKey, null); return; }
    const blob = new Blob([rec.data], { type: rec.mimeType });
    const bmp = await createImageBitmap(blob);
    _imgCache.set(blobKey, bmp);
    if (_dirtyCallback) _dirtyCallback(); // trigger re-render
  } catch { _imgCache.set(blobKey, null); }
}

export function getImageBitmap(blobKey) {
  if (!blobKey) return null;
  const cached = _imgCache.get(blobKey);
  if (cached === undefined) { _ensureImage(blobKey); return null; }
  if (cached === 'loading' || cached === null) return null;
  return cached;
}

/** Phase 1 stub: draws elements as simple colored rects */
function stubRender(ctx, el) {
  ctx.strokeStyle = el.strokeColor || '#ddd9d6';
  ctx.lineWidth = el.strokeWidth || 2;
  if (el.fillColor && el.fillColor !== 'transparent') {
    ctx.fillStyle = el.fillColor;
    ctx.fillRect(el.x, el.y, el.width || 40, el.height || 40);
  }
  ctx.strokeRect(el.x, el.y, el.width || 40, el.height || 40);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let _styles = {};  // { sketch: module, clean: module }

  function registerStyle(name, mod) { _styles[name] = mod; }

  function render(elements, camera, selection, hoveredId, renderStyle, spatialIdx, ghost, marquee) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // apply camera
    ctx.setTransform(
      camera.zoom * dpr, 0, 0, camera.zoom * dpr,
      camera.x * dpr, camera.y * dpr,
    );

    // viewport in world coords for culling
    const tl = screenToWorld(0, 0, camera);
    const br = screenToWorld(w, h, camera);

    // dot grid background (draws in world space, moves with camera)
    _drawDotGrid(ctx, tl, br, camera);
    const viewRect = { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };

    // cull — use spatial index if available, fall back to all elements
    let visible;
    if (spatialIdx && elements.length > 0) {
      visible = spatialIdx.query(viewRect);
      // fallback if spatial index returns nothing but elements exist
      if (visible.length === 0) visible = elements;
    } else {
      visible = elements;
    }

    // sort by zIndex
    const sorted = [...visible].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // pick style renderer
    const style = _styles[renderStyle];

    for (const el of sorted) {
      const isSel = selection && selection.has(el.id);
      const isHov = el.id === hoveredId;
      if (style && style.renderElement) {
        style.renderElement(ctx, el, isSel, isHov);
      } else {
        stubRender(ctx, el);
      }
    }

    // draw ghost element (during creation drag)
    if (ghost) {
      ctx.globalAlpha = 0.6;
      if (style && style.renderElement) {
        style.renderElement(ctx, ghost, false, false);
      } else {
        stubRender(ctx, ghost);
      }
      ctx.globalAlpha = 1;
    }

    // draw selection UI
    if (selection && selection.size > 0) {
      for (const el of sorted) {
        if (selection.has(el.id)) _drawSelectionBox(ctx, el, camera);
      }
    }

    // draw hover outline
    if (hoveredId && (!selection || !selection.has(hoveredId))) {
      const hEl = elements.find(e => e.id === hoveredId);
      if (hEl) _drawHoverBox(ctx, hEl, camera);
    }

    // reset transform for screen-space UI
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // marquee
    if (marquee) {
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(68,136,255,0.08)';
      ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
      ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
      ctx.setLineDash([]);
    }
  }

  return { render, registerStyle, ctx };
}

function _drawSelectionBox(ctx, el, camera) {
  const b = getBounds(el);
  const pad = 4 / camera.zoom;
  const lw = 1.5 / camera.zoom;
  ctx.save();
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = lw;
  ctx.setLineDash([6 / camera.zoom, 3 / camera.zoom]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  ctx.setLineDash([]);

  // 8 handles
  const hs = 6 / camera.zoom;
  const positions = _handlePositions(b, pad);
  for (const [hx, hy] of positions) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  ctx.restore();
}

function _drawHoverBox(ctx, el, camera) {
  const b = getBounds(el);
  const pad = 3 / camera.zoom;
  ctx.save();
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 1 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  ctx.setLineDash([]);
  ctx.restore();
}

/** b = { x, y, width, height } bounding box */
function _handlePositions(b, pad) {
  const x = b.x - pad;
  const y = b.y - pad;
  const w = b.width + pad * 2;
  const h = b.height + pad * 2;
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

function _drawDotGrid(ctx, tl, br, camera) {
  // adaptive grid spacing: 20px at zoom 1, scales to stay usable
  let spacing = 20;
  if (camera.zoom < 0.4) spacing = 60;
  else if (camera.zoom < 0.8) spacing = 40;
  else if (camera.zoom > 3) spacing = 10;

  const dotSize = Math.max(0.5, 1 / camera.zoom);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';

  const startX = Math.floor(tl.x / spacing) * spacing;
  const startY = Math.floor(tl.y / spacing) * spacing;

  for (let x = startX; x <= br.x; x += spacing) {
    for (let y = startY; y <= br.y; y += spacing) {
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    }
  }
}

export { _handlePositions as getHandlePositions };
