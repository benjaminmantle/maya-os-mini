/* Neon style — cyberpunk glow renderer (pure Canvas 2D) */
import { getImageBitmap } from '../renderer.js';

const GLOW_BASE = 8;

function glowBlur(strokeWidth, hovered) {
  const base = GLOW_BASE + strokeWidth * 2;
  return hovered ? base * 1.5 : base;
}

export function renderElement(ctx, el, isSelected, isHovered) {
  ctx.save();
  if (el.opacity !== undefined && el.opacity < 1) {
    ctx.globalAlpha = el.opacity;
  }

  ctx.translate(el.x, el.y);

  const type = el.type;
  const stroke = el.strokeColor || '#ddd9d6';
  const fill = el.fillColor;
  const lw = el.strokeWidth || 2;
  const blur = glowBlur(lw, isHovered);

  if (type === 'rectangle') {
    _drawRectNeon(ctx, el, stroke, fill, lw, blur);
  } else if (type === 'ellipse') {
    _drawEllipseNeon(ctx, el, stroke, fill, lw, blur);
  } else if (type === 'line') {
    _drawLineNeon(ctx, el, stroke, lw, blur);
  } else if (type === 'arrow') {
    _drawLineNeon(ctx, el, stroke, lw, blur);
    _drawArrowheads(ctx, el, stroke, lw, blur);
  } else if (type === 'freehand') {
    _drawFreehandNeon(ctx, el, stroke, lw, blur);
  } else if (type === 'text') {
    _drawTextNeon(ctx, el, blur);
  } else if (type === 'image') {
    _drawImage(ctx, el);
  }

  ctx.restore();
}

/* ---- Shapes ---- */

function _drawRectNeon(ctx, el, stroke, fill, lw, blur) {
  // subtle fill glow
  if (fill && fill !== 'transparent') {
    ctx.fillStyle = fill;
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.12;
    ctx.shadowColor = fill;
    ctx.shadowBlur = blur * 0.5;
    ctx.fillRect(0, 0, el.width, el.height);
    ctx.globalAlpha = (el.opacity !== undefined ? el.opacity : 1);
  }

  // glow pass
  ctx.shadowColor = stroke;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.strokeRect(0, 0, el.width, el.height);

  // crisp pass
  ctx.shadowBlur = 0;
  ctx.strokeRect(0, 0, el.width, el.height);
}

function _drawEllipseNeon(ctx, el, stroke, fill, lw, blur) {
  const cx = el.width / 2, cy = el.height / 2;
  const rx = el.width / 2, ry = el.height / 2;

  if (fill && fill !== 'transparent') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.12;
    ctx.shadowColor = fill;
    ctx.shadowBlur = blur * 0.5;
    ctx.fill();
    ctx.globalAlpha = (el.opacity !== undefined ? el.opacity : 1);
  }

  // glow pass
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.shadowColor = stroke;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();

  // crisp pass
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.shadowBlur = 0;
  ctx.stroke();
}

/* ---- Lines ---- */

function _drawLineNeon(ctx, el, stroke, lw, blur) {
  if (!el.points || el.points.length < 2) return;

  // glow pass
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  ctx.shadowColor = stroke;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // crisp pass
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  ctx.stroke();
}

function _drawArrowheads(ctx, el, stroke, lw, blur) {
  if (!el.points || el.points.length < 2) return;
  const pts = el.points;

  if (el.arrowEnd === 'arrow' || el.arrowEnd === undefined) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    _arrowhead(ctx, prev.x, prev.y, last.x, last.y, stroke, lw, blur);
  }
  if (el.arrowStart === 'arrow') {
    const first = pts[0];
    const next = pts[1];
    _arrowhead(ctx, next.x, next.y, first.x, first.y, stroke, lw, blur);
  }
}

function _arrowhead(ctx, fromX, fromY, toX, toY, stroke, lw, blur) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const len = 10 + lw * 2;
  const spread = Math.PI / 7;

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - len * Math.cos(angle - spread), toY - len * Math.sin(angle - spread));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - len * Math.cos(angle + spread), toY - len * Math.sin(angle + spread));
  ctx.shadowColor = stroke;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();

  // crisp pass
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - len * Math.cos(angle - spread), toY - len * Math.sin(angle - spread));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - len * Math.cos(angle + spread), toY - len * Math.sin(angle + spread));
  ctx.stroke();
}

/* ---- Freehand ---- */

function _drawFreehandNeon(ctx, el, stroke, lw, blur) {
  if (!el.points || el.points.length < 2) return;

  // glow pass
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  ctx.shadowColor = stroke;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // crisp pass
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  ctx.stroke();
}

/* ---- Text ---- */

function _drawTextNeon(ctx, el, blur) {
  const color = el.strokeColor || '#ddd9d6';
  const size = el.fontSize || 20;
  ctx.font = `${size}px Rajdhani, sans-serif`;
  ctx.textAlign = el.textAlign || 'left';
  ctx.textBaseline = 'top';

  const lines = (el.text || '').split('\n');

  // glow pass
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * 0.8;
  ctx.fillStyle = color;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, i * size * 1.4);
  }

  // crisp pass
  ctx.shadowBlur = 0;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, i * size * 1.4);
  }
}

/* ---- Image ---- */

function _drawImage(ctx, el) {
  const bmp = getImageBitmap(el.blobKey);
  if (bmp) {
    ctx.drawImage(bmp, 0, 0, el.width || bmp.width, el.height || bmp.height);
    return;
  }
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(0, 0, el.width || 100, el.height || 100);
  ctx.setLineDash([]);
  ctx.fillStyle = '#666';
  ctx.font = '14px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading...', (el.width || 100) / 2, (el.height || 100) / 2);
}

export function getName() { return 'Neon'; }
