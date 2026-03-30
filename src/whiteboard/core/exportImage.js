/* Board / selection export as PNG image */

import { getBounds } from '../elements/bounds.js';
import * as sketchStyle from '../render/styles/sketchStyle.js';
import * as cleanStyle from '../render/styles/cleanStyle.js';
import rough from 'roughjs';

const STYLES = { sketch: sketchStyle, clean: cleanStyle };

/**
 * Export elements to a PNG blob.
 *
 * @param {Array} elements  — elements to export (full board or selection)
 * @param {string} renderStyle — 'sketch' or 'clean'
 * @param {Object} opts — { padding, background, scale }
 * @returns {Promise<Blob>} PNG blob
 */
export async function exportToPNG(elements, renderStyle, opts = {}) {
  const {
    padding = 20,
    background = '#1a1a2e', // var(--bg) dark default
    scale = 2,             // 2x for high quality
  } = opts;

  if (!elements || elements.length === 0) return null;

  // compute bounding box of all elements
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

  // create offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext('2d');

  // background
  if (background && background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // scale and translate so elements draw at correct positions
  ctx.scale(scale, scale);
  ctx.translate(padding - minX, padding - minY);

  // sort by zIndex
  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // render each element
  const style = STYLES[renderStyle] || STYLES.sketch;
  for (const el of sorted) {
    style.renderElement(ctx, el, false, false);
  }

  // convert to blob
  return new Promise(resolve => {
    offscreen.toBlob(blob => resolve(blob), 'image/png');
  });
}

/**
 * Export and trigger download.
 */
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

/**
 * Export and copy to clipboard.
 */
export async function copyPNG(elements, renderStyle, opts) {
  const blob = await exportToPNG(elements, renderStyle, opts);
  if (!blob) return;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
