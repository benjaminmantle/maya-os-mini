/* Sketch style — roughjs hand-drawn renderer */

import rough from 'roughjs';

let _roughCanvas = null;
let _canvasEl = null;
const _cache = new Map(); // elementId → { hash, drawable }

function getRough(canvas) {
  if (_canvasEl !== canvas) {
    _canvasEl = canvas;
    _roughCanvas = rough.canvas(canvas);
  }
  return _roughCanvas;
}

/** Cache key — only style+size, NOT position (we translate for position) */
function styleHash(el) {
  return `${el.type}_${el.width}_${el.height}_${el.strokeColor}_${el.fillColor}_${el.strokeWidth}_${el.fillStyle}_${(el.points || []).length}`;
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
    _drawCached(rc, el, () =>
      rc.rectangle(0, 0, el.width, el.height, roughOpts(el))
    );
  } else if (type === 'ellipse') {
    _drawCached(rc, el, () =>
      rc.ellipse(el.width / 2, el.height / 2, el.width, el.height, roughOpts(el))
    );
  } else if (type === 'line') {
    _renderLine(rc, ctx, el);
  } else if (type === 'arrow') {
    _renderArrow(rc, ctx, el);
  } else if (type === 'freehand') {
    _renderFreehand(rc, ctx, el);
  } else if (type === 'text') {
    _renderText(ctx, el);
  } else if (type === 'image') {
    _renderImagePlaceholder(ctx, el);
  }

  ctx.restore();
}

function _drawCached(rc, el, generator) {
  const hash = styleHash(el);
  const cached = _cache.get(el.id);
  let drawable;
  if (cached && cached.hash === hash) {
    drawable = cached.drawable;
  } else {
    drawable = generator();
    _cache.set(el.id, { hash, drawable });
  }
  rc.draw(drawable);
}

function _renderLine(rc, ctx, el) {
  if (!el.points || el.points.length < 2) return;
  const opts = roughOpts(el);
  for (let i = 0; i < el.points.length - 1; i++) {
    const a = el.points[i];
    const b = el.points[i + 1];
    rc.line(a.x, a.y, b.x, b.y, opts);
  }
}

function _renderArrow(rc, ctx, el) {
  _renderLine(rc, ctx, el);
  if (el.points && el.points.length >= 2) {
    const pts = el.points;
    if (el.arrowEnd === 'arrow' || el.arrowEnd === undefined) {
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      _drawArrowhead(ctx, el, prev.x, prev.y, last.x, last.y);
    }
    if (el.arrowStart === 'arrow') {
      const first = pts[0];
      const next = pts[1];
      _drawArrowhead(ctx, el, next.x, next.y, first.x, first.y);
    }
  }
}

function _drawArrowhead(ctx, el, fromX, fromY, toX, toY) {
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

function _renderFreehand(rc, ctx, el) {
  if (!el.points || el.points.length < 2) return;
  const pts = el.points.map(p => [p.x, p.y]);
  const opts = roughOpts(el);
  opts.roughness = 0.5;
  rc.linearPath(pts, opts);
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
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(0, 0, el.width || 100, el.height || 100);
  ctx.setLineDash([]);
  ctx.fillStyle = '#666';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Image', (el.width || 100) / 2, (el.height || 100) / 2);
}

export function getName() { return 'Sketch'; }

export function invalidateCache(id) { _cache.delete(id); }
export function clearCache() { _cache.clear(); }
