/* Board SVG export */

import { getBounds } from '../elements/bounds.js';

/**
 * Export elements to an SVG string.
 */
export function exportToSVG(elements, opts = {}) {
  const { padding = 20, background = '#1a1a2e' } = opts;

  if (!elements || elements.length === 0) return '';

  // compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;
  const offX = padding - minX;
  const offY = padding - minY;

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  let svgContent = '';
  for (const el of sorted) {
    svgContent += _elToSVG(el, offX, offY);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${background}" />
  <g transform="translate(${offX}, ${offY})">
${svgContent}  </g>
</svg>`;
}

export function downloadSVG(elements, filename, opts) {
  const svg = exportToSVG(elements, opts);
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'cosmicanvas-board.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _elToSVG(el, offX, offY) {
  const x = el.x;
  const y = el.y;
  const stroke = el.strokeColor || '#ddd9d6';
  const fill = el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : 'none';
  const sw = el.strokeWidth || 2;
  const opacity = el.opacity != null && el.opacity < 1 ? ` opacity="${el.opacity}"` : '';

  if (el.type === 'rectangle') {
    return `    <rect x="${x}" y="${y}" width="${el.width}" height="${el.height}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}"${opacity} />\n`;
  }

  if (el.type === 'ellipse') {
    const cx = x + el.width / 2;
    const cy = y + el.height / 2;
    return `    <ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}"${opacity} />\n`;
  }

  if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
    const pts = el.points.map(p => `${x + p.x},${y + p.y}`).join(' ');
    let svg = `    <polyline points="${pts}" stroke="${stroke}" stroke-width="${sw}" fill="none"${opacity} />\n`;
    if (el.type === 'arrow' && (el.arrowEnd === 'arrow' || el.arrowEnd === undefined)) {
      svg += _arrowheadSVG(el, x, y, stroke, sw);
    }
    return svg;
  }

  if (el.type === 'freehand' && el.points && el.points.length >= 2) {
    const pts = el.points.map(p => `${x + p.x},${y + p.y}`).join(' ');
    return `    <polyline points="${pts}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"${opacity} />\n`;
  }

  if (el.type === 'text') {
    const size = el.fontSize || 20;
    const escaped = (el.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = escaped.split('\n');
    let tspans = lines.map((line, i) =>
      `<tspan x="${x}" dy="${i === 0 ? 0 : size * 1.4}">${line}</tspan>`
    ).join('');
    return `    <text x="${x}" y="${y}" fill="${stroke}" font-size="${size}" font-family="sans-serif"${opacity}>${tspans}</text>\n`;
  }

  return '';
}

function _arrowheadSVG(el, baseX, baseY, stroke, sw) {
  const pts = el.points;
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const tx = baseX + last.x, ty = baseY + last.y;
  const fx = baseX + prev.x, fy = baseY + prev.y;
  const angle = Math.atan2(ty - fy, tx - fx);
  const len = 12 + sw * 2;
  const spread = Math.PI / 7;
  const x1 = tx - len * Math.cos(angle - spread);
  const y1 = ty - len * Math.sin(angle - spread);
  const x2 = tx - len * Math.cos(angle + spread);
  const y2 = ty - len * Math.sin(angle + spread);
  return `    <polyline points="${x1},${y1} ${tx},${ty} ${x2},${y2}" stroke="${stroke}" stroke-width="${sw}" fill="none" />\n`;
}
