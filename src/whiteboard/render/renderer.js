/* Render orchestrator — delegates to active style renderer */

import { screenToWorld } from '../core/camera.js';

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
    const viewRect = { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };

    // cull
    let visible;
    if (spatialIdx) {
      visible = spatialIdx.query(viewRect);
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
  const pad = 4 / camera.zoom;
  const lw = 1.5 / camera.zoom;
  ctx.save();
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = lw;
  ctx.setLineDash([6 / camera.zoom, 3 / camera.zoom]);
  ctx.strokeRect(
    el.x - pad, el.y - pad,
    (el.width || 0) + pad * 2, (el.height || 0) + pad * 2,
  );
  ctx.setLineDash([]);

  // 8 handles
  const hs = 6 / camera.zoom;
  const positions = _handlePositions(el, pad);
  for (const [hx, hy] of positions) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  ctx.restore();
}

function _drawHoverBox(ctx, el, camera) {
  const pad = 3 / camera.zoom;
  ctx.save();
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 1 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
  ctx.strokeRect(
    el.x - pad, el.y - pad,
    (el.width || 0) + pad * 2, (el.height || 0) + pad * 2,
  );
  ctx.setLineDash([]);
  ctx.restore();
}

function _handlePositions(el, pad) {
  const x = el.x - pad;
  const y = el.y - pad;
  const w = (el.width || 0) + pad * 2;
  const h = (el.height || 0) + pad * 2;
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

export { _handlePositions as getHandlePositions };
