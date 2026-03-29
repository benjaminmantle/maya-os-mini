/* Undo/redo command stack */

import { MAX_HISTORY } from './constants.js';

if (!window.__boardHistory) {
  window.__boardHistory = { undoStack: [], redoStack: [] };
}
const H = window.__boardHistory;

/** Push a command: { type, elementIds, before, after } */
export function pushCommand(cmd) {
  H.undoStack.push(cmd);
  if (H.undoStack.length > MAX_HISTORY) H.undoStack.shift();
  H.redoStack.length = 0; // clear redo on new action
}

/** Pop undo — returns command with `before` state to restore */
export function undo() {
  if (H.undoStack.length === 0) return null;
  const cmd = H.undoStack.pop();
  H.redoStack.push(cmd);
  return cmd;
}

/** Pop redo — returns command with `after` state to restore */
export function redo() {
  if (H.redoStack.length === 0) return null;
  const cmd = H.redoStack.pop();
  H.undoStack.push(cmd);
  return cmd;
}

export function canUndo() { return H.undoStack.length > 0; }
export function canRedo() { return H.redoStack.length > 0; }

export function clearHistory() {
  H.undoStack.length = 0;
  H.redoStack.length = 0;
}
