/* Board / selection export as PNG image */

import { getBounds } from '../elements/bounds.js';
import rough from 'roughjs';

/**
 * Export elements to a PNG blob.
 * Uses a dedicated offscreen canvas + fresh roughjs instance
 * so it doesn't pollute the live renderer's cache.
 */
export async function exportToPNG(elements, renderStyle, opts = {}) {
  const {
    padding = 20,
    background = '#1a1a2e',
    scale = 2,
  } = opts;

  if (!elements || elements.length === 0) return null;

  // compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const canvasW = (contentW + padding * 2) * scale;
  const canvasH = (contentH + padding * 2) * scale;

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext('2d');

  // background
  if (background && background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  ctx.scale(scale, scale);
  ctx.translate(padding - minX, padding - minY);

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // fresh roughjs instance for offscreen canvas (doesn't pollute live cache)
  const rc = rough.canvas(offscreen);

  for (const el of sorted) {
    if (renderStyle === 'sketch') {
      _renderSketch(ctx, rc, el);
    } else {
      _renderClean(ctx, el);
    }
  }

  return new Promise(resolve => {
    offscreen.toBlob(blob => resolve(blob), 'image/png');
  });
}

export async function downloadPNG(elements, renderStyle, filename, opts) {
  const blob = await exportToPNG(elements, renderStyle, opts);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'cosmicanvas-export.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyPNG(elements, renderStyle, opts) {
  const blob = await exportToPNG(elements, renderStyle, opts);
  if (!blob) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch { return false; }
}

/* ---- private renderers (self-contained, no shared cache) ---- */

function _roughOpts(el) {
  const opts = {
    stroke: el.strokeColor || '#ddd9d6',
    strokeWidth: el.strokeWidth || 2,
    roughness: 1, bowing: 1,
  };
  if (el.fillColor && el.fillColor !== 'transparent') {
    opts.fill = el.fillColor;
    opts.fillStyle = el.fillStyle === 'none' ? undefined : el.fillStyle || 'hachure';
  }
  return opts;
}

function _renderSketch(ctx, rc, el) {
  ctx.save();
  if (el.opacity != null && el.opacity < 1) ctx.globalAlpha = el.opacity;
  ctx.translate(el.x, el.y);
  const t = el.type, opts = _roughOpts(el);

  if (t === 'rectangle') { rc.rectangle(0, 0, el.width, el.height, opts); }
  else if (t === 'ellipse') { rc.ellipse(el.width / 2, el.height / 2, el.width, el.height, opts); }
  else if (t === 'line' || t === 'arrow') {
    if (el.points && el.points.length >= 2) {
      for (let i = 0; i < el.points.length - 1; i++) {
        rc.line(el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y, opts);
      }
      if (t === 'arrow') _arrowheads(ctx, el);
    }
  }
  else if (t === 'freehand' && el.points && el.points.length >= 2) {
    rc.linearPath(el.points.map(p => [p.x, p.y]), { ...opts, roughness: 0.5 });
  }
  else if (t === 'text') { _text(ctx, el); }

  ctx.restore();
}

function _renderClean(ctx, el) {
  ctx.save();
  if (el.opacity != null && el.opacity < 1) ctx.globalAlpha = el.opacity;
  ctx.translate(el.x, el.y);
  const t = el.type;
  const stroke = el.strokeColor || '#ddd9d6';
  const fill = el.fillColor;
  const lw = el.strokeWidth || 2;

  if (t === 'rectangle') {
    if (fill && fill !== 'transparent') { ctx.fillStyle = fill; ctx.fillRect(0, 0, el.width, el.height); }
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(0, 0, el.width, el.height);
  }
  else if (t === 'ellipse') {
    ctx.beginPath(); ctx.ellipse(el.width / 2, el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    if (fill && fill !== 'transparent') { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
  }
  else if ((t === 'line' || t === 'arrow') && el.points && el.points.length >= 2) {
    ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
    if (t === 'arrow') _arrowheads(ctx, el);
  }
  else if (t === 'freehand' && el.points && el.points.length >= 2) {
    ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  else if (t === 'text') { _text(ctx, el); }

  ctx.restore();
}

function _text(ctx, el) {
  ctx.fillStyle = el.strokeColor || '#ddd9d6';
  const sz = el.fontSize || 20;
  ctx.font = `${sz}px Segoe Print, Comic Sans MS, cursive`;
  ctx.textAlign = el.textAlign || 'left';
  ctx.textBaseline = 'top';
  (el.text || '').split('\n').forEach((line, i) => ctx.fillText(line, 0, i * sz * 1.4));
}

function _arrowheads(ctx, el) {
  if (!el.points || el.points.length < 2) return;
  const pts = el.points;
  const _ah = (fx, fy, tx, ty) => {
    const a = Math.atan2(ty - fy, tx - fx), len = 12 + (el.strokeWidth || 2) * 2, sp = Math.PI / 7;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.lineTo(tx - len * Math.cos(a - sp), ty - len * Math.sin(a - sp));
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - len * Math.cos(a + sp), ty - len * Math.sin(a + sp));
    ctx.strokeStyle = el.strokeColor || '#ddd9d6'; ctx.lineWidth = el.strokeWidth || 2; ctx.stroke();
  };
  if (el.arrowEnd === 'arrow' || el.arrowEnd === undefined) {
    const l = pts[pts.length - 1], p = pts[pts.length - 2];
    _ah(p.x, p.y, l.x, l.y);
  }
  if (el.arrowStart === 'arrow') { _ah(pts[1].x, pts[1].y, pts[0].x, pts[0].y); }
}
