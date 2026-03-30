/* Board JSON export / import */

import { getElements, getCamera, getRenderStyle, addElement, setCamera, setRenderStyle, deleteElements, getNextZIndex } from '../store/whiteboardStore.js';
import { elId } from './constants.js';

/**
 * Export current board state as a JSON string.
 */
export function exportBoardJSON() {
  return JSON.stringify({
    version: 1,
    exportedAt: Date.now(),
    camera: getCamera(),
    renderStyle: getRenderStyle(),
    elements: getElements().map(el => ({ ...el })),
  }, null, 2);
}

/**
 * Download board as .json file.
 */
export function downloadBoardJSON(filename) {
  const json = exportBoardJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'cosmicanvas-board.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import elements from a JSON file.
 * Additive — fresh IDs, appended to current board.
 * Returns count of imported elements.
 */
export function importBoardJSON(jsonStr) {
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return 0;
  }

  const elements = data.elements;
  if (!Array.isArray(elements) || elements.length === 0) return 0;

  let count = 0;
  let baseZ = getNextZIndex();
  for (const el of elements) {
    // fresh IDs to avoid collisions
    el.id = elId();
    el.zIndex = baseZ++;
    addElement(el);
    count++;
  }

  // optionally restore camera/style
  if (data.camera) setCamera(data.camera);
  if (data.renderStyle) setRenderStyle(data.renderStyle);

  return count;
}

/**
 * Read a File object and import its JSON content.
 */
export function importBoardFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const count = importBoardJSON(reader.result);
      resolve(count);
    };
    reader.onerror = () => resolve(0);
    reader.readAsText(file);
  });
}
