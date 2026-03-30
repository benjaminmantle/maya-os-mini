/* Clean style — pure Canvas 2D geometric renderer */
import { getImageBitmap } from '../renderer.js';

export function renderElement(ctx, el, isSelected, isHovered) {
  ctx.save();
  if (el.opacity !== undefined && el.opacity < 1) {
    ctx.globalAlpha = el.opacity;
  }

  // translate to element position — all drawing at origin
  ctx.translate(el.x, el.y);

  const type = el.type;
  const stroke = el.strokeColor || '#ddd9d6';
  const fill = el.fillColor;
  const lw = el.strokeWidth || 2;

  if (type === 'rectangle') {
    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, el.width, el.height);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.strokeRect(0, 0, el.width, el.height);
  }

  else if (type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(el.width / 2, el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  else if (type === 'line') {
    _drawLine(ctx, el, stroke, lw);
  }

  else if (type === 'arrow') {
    _drawLine(ctx, el, stroke, lw);
    _drawArrowheads(ctx, el, stroke, lw);
  }

  else if (type === 'freehand') {
    _drawFreehand(ctx, el, stroke, lw);
  }

  else if (type === 'text') {
    _drawText(ctx, el);
  }

  else if (type === 'image') {
    _drawImagePlaceholder(ctx, el);
  }

  ctx.restore();
}

function _drawLine(ctx, el, stroke, lw) {
  if (!el.points || el.points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function _drawArrowheads(ctx, el, stroke, lw) {
  if (!el.points || el.points.length < 2) return;
  const pts = el.points;

  if (el.arrowEnd === 'arrow' || el.arrowEnd === undefined) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    _arrowhead(ctx, prev.x, prev.y, last.x, last.y, stroke, lw);
  }
  if (el.arrowStart === 'arrow') {
    const first = pts[0];
    const next = pts[1];
    _arrowhead(ctx, next.x, next.y, first.x, first.y, stroke, lw);
  }
}

function _arrowhead(ctx, fromX, fromY, toX, toY, stroke, lw) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const len = 10 + lw * 2;
  const spread = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - len * Math.cos(angle - spread), toY - len * Math.sin(angle - spread));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - len * Math.cos(angle + spread), toY - len * Math.sin(angle + spread));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function _drawFreehand(ctx, el, stroke, lw) {
  if (!el.points || el.points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function _drawText(ctx, el) {
  ctx.fillStyle = el.strokeColor || '#ddd9d6';
  const size = el.fontSize || 20;
  ctx.font = `${size}px Rajdhani, sans-serif`;
  ctx.textAlign = el.textAlign || 'left';
  ctx.textBaseline = 'top';
  const lines = (el.text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, i * size * 1.4);
  }
}

function _drawImagePlaceholder(ctx, el) {
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

export function getName() { return 'Clean'; }
