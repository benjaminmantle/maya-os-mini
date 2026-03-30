/* Sketch style — roughjs hand-drawn renderer */

import rough from 'roughjs';
import { getImageBitmap } from '../renderer.js';

let _roughCanvas = null;
let _canvasEl = null;
const _cache = new Map(); // elementId → { hash, drawables[] }

function getRough(canvas) {
  if (_canvasEl !== canvas) {
    _canvasEl = canvas;
    _roughCanvas = rough.canvas(canvas);
  }
  return _roughCanvas;
}

/**
 * Cache key — style+size+points. NOT position (we ctx.translate for that).
 * Includes a lightweight points fingerprint so the cache invalidates when
 * points change (resize, freehand simplification) but NOT when x/y moves.
 */
function styleHash(el) {
  let ptHash = '';
  if (el.points && el.points.length) {
    // sample first, last, and length for a fast fingerprint
    const f = el.points[0];
    const l = el.points[el.points.length - 1];
    ptHash = `_p${el.points.length}_${f.x|0}_${f.y|0}_${l.x|0}_${l.y|0}`;
  }
  return `${el.type}_${el.width}_${el.height}_${el.strokeColor}_${el.fillColor}_${el.strokeWidth}_${el.fillStyle}${ptHash}`;
}

function roughOpts(el) {
  const opts = {
    stroke: el.strokeColor || '#ddd9d6',
    strokeWidth: el.strokeWidth || 2,
    roughness: 1,
    bowing: 1,
  };
  if (el.fillColor && el.fillColor !== 'transparent') {
    opts.fill = el.fillColor;
    opts.fillStyle = el.fillStyle === 'none' ? undefined :
                     el.fillStyle || 'hachure';
  }
  return opts;
}

export function renderElement(ctx, el, isSelected, isHovered) {
  const rc = getRough(ctx.canvas);
  if (!rc) return;

  ctx.save();
  if (el.opacity !== undefined && el.opacity < 1) {
    ctx.globalAlpha = el.opacity;
  }

  // translate to element position — drawables are created at origin
  ctx.translate(el.x, el.y);

  const type = el.type;

  if (type === 'rectangle') {
    _drawCached(rc, el, () => [
      rc.rectangle(0, 0, el.width, el.height, roughOpts(el)),
    ]);
  } else if (type === 'ellipse') {
    _drawCached(rc, el, () => [
      rc.ellipse(el.width / 2, el.height / 2, el.width, el.height, roughOpts(el)),
    ]);
  } else if (type === 'line' || type === 'arrow') {
    _drawCached(rc, el, () => _genLineDrawables(rc, el));
    if (type === 'arrow') _drawArrowheads(ctx, el);
  } else if (type === 'freehand') {
    _drawCached(rc, el, () => _genFreehandDrawables(rc, el));
  } else if (type === 'text') {
    _renderText(ctx, el);
  } else if (type === 'image') {
    _renderImagePlaceholder(ctx, el);
  }

  ctx.restore();
}

/** Cache stores an array of drawables. Generator must return drawable[]. */
function _drawCached(rc, el, generator) {
  const hash = styleHash(el);
  const cached = _cache.get(el.id);
  let drawables;
  if (cached && cached.hash === hash) {
    drawables = cached.drawables;
  } else {
    drawables = generator();
    _cache.set(el.id, { hash, drawables });
  }
  for (const d of drawables) rc.draw(d);
}

/** Generate roughjs drawables for line segments (cached) */
function _genLineDrawables(rc, el) {
  if (!el.points || el.points.length < 2) return [];
  const opts = roughOpts(el);
  const drawables = [];
  for (let i = 0; i < el.points.length - 1; i++) {
    const a = el.points[i];
    const b = el.points[i + 1];
    drawables.push(rc.line(a.x, a.y, b.x, b.y, opts));
  }
  return drawables;
}

/** Generate roughjs drawable for freehand path (cached) */
function _genFreehandDrawables(rc, el) {
  if (!el.points || el.points.length < 2) return [];
  const pts = el.points.map(p => [p.x, p.y]);
  const opts = roughOpts(el);
  opts.roughness = 0.5;
  return [rc.linearPath(pts, opts)];
}

/** Arrowheads drawn with plain Canvas 2D (no randomness, no cache needed) */
function _drawArrowheads(ctx, el) {
  if (!el.points || el.points.length < 2) return;
  const pts = el.points;
  if (el.arrowEnd === 'arrow' || el.arrowEnd === undefined) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    _arrowhead(ctx, el, prev.x, prev.y, last.x, last.y);
  }
  if (el.arrowStart === 'arrow') {
    const first = pts[0];
    const next = pts[1];
    _arrowhead(ctx, el, next.x, next.y, first.x, first.y);
  }
}

function _arrowhead(ctx, el, fromX, fromY, toX, toY) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const len = 12 + (el.strokeWidth || 2) * 2;
  const spread = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - len * Math.cos(angle - spread),
    toY - len * Math.sin(angle - spread),
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - len * Math.cos(angle + spread),
    toY - len * Math.sin(angle + spread),
  );
  ctx.strokeStyle = el.strokeColor || '#ddd9d6';
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.stroke();
}

function _renderText(ctx, el) {
  ctx.fillStyle = el.strokeColor || '#ddd9d6';
  const size = el.fontSize || 20;
  const family = el.fontFamily === 'mono' ? 'monospace' :
                 el.fontFamily === 'sans' ? 'Rajdhani, sans-serif' :
                 'Segoe Print, Comic Sans MS, cursive';
  ctx.font = `${size}px ${family}`;
  ctx.textAlign = el.textAlign || 'left';
  ctx.textBaseline = 'top';
  const lines = (el.text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, i * size * 1.4);
  }
}

function _renderImagePlaceholder(ctx, el) {
  const bmp = getImageBitmap(el.blobKey);
  if (bmp) {
    ctx.drawImage(bmp, 0, 0, el.width || bmp.width, el.height || bmp.height);
    return;
  }
  // fallback placeholder while loading
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(0, 0, el.width || 100, el.height || 100);
  ctx.setLineDash([]);
  ctx.fillStyle = '#666';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading...', (el.width || 100) / 2, (el.height || 100) / 2);
}

export function getName() { return 'Sketch'; }

export function invalidateCache(id) { _cache.delete(id); }
export function clearCache() { _cache.clear(); }
