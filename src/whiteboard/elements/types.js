/* Element factory functions */

import { elId, DEFAULTS } from '../core/constants.js';
import { getNextZIndex } from '../store/whiteboardStore.js';

function base(type, overrides = {}) {
  return {
    id: elId(),
    type,
    x: 0, y: 0,
    width: 0, height: 0,
    points: [],
    rotation: 0,
    zIndex: getNextZIndex(),
    groupId: null,
    strokeColor: DEFAULTS.strokeColor,
    fillColor: DEFAULTS.fillColor,
    strokeWidth: DEFAULTS.strokeWidth,
    fillStyle: DEFAULTS.fillStyle,
    opacity: DEFAULTS.opacity,
    text: '',
    fontSize: DEFAULTS.fontSize,
    fontFamily: DEFAULTS.fontFamily,
    textAlign: DEFAULTS.textAlign,
    arrowStart: 'none',
    arrowEnd: 'none',
    bendPoints: [],
    blobKey: null,
    cropShape: 'rect',
    cropOffset: { x: 0, y: 0, zoom: 1 },
    startBinding: null,
    endBinding: null,
    ...overrides,
  };
}

export function createRectangle(x, y, w, h, style = {}) {
  return base('rectangle', { x, y, width: w, height: h, ...style });
}

export function createEllipse(x, y, w, h, style = {}) {
  return base('ellipse', { x, y, width: w, height: h, ...style });
}

export function createLine(x, y, points, style = {}) {
  return base('line', { x, y, points, ...style });
}

export function createArrow(x, y, points, style = {}) {
  return base('arrow', { x, y, points, arrowEnd: 'arrow', ...style });
}

export function createFreehand(x, y, points, style = {}) {
  return base('freehand', { x, y, points, ...style });
}

export function createText(x, y, text, style = {}) {
  const el = base('text', { x, y, text, ...style });
  // measure approximate size
  el.width = Math.max(20, text.length * el.fontSize * 0.6);
  el.height = el.fontSize * 1.4;
  return el;
}

export function createImage(x, y, w, h, blobKey) {
  return base('image', { x, y, width: w, height: h, blobKey });
}

export function cloneElement(el) {
  const clone = JSON.parse(JSON.stringify(el));
  clone.id = elId();
  return clone;
}
