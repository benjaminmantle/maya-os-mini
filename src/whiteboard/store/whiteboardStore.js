/* CosmiCanvas store — all whiteboard data access goes through here */

import { boardId, DEBOUNCE_MS } from '../core/constants.js';
import * as idb from './idb.js';

/* ---- HMR-safe pub/sub ---- */
if (!window.__boardListeners) window.__boardListeners = new Set();
const listeners = window.__boardListeners;

if (!window.__boardS) {
  window.__boardS = {
    board: null,   // active board (full object) or null
    boards: [],    // lightweight list [{id,name,updatedAt}]
    openTabs: [],  // [{ id, name }] — boards open as tabs
    ready: false,
  };
}
const S = window.__boardS;

function notify() { listeners.forEach(fn => fn()); }
export function subscribe(fn)   { listeners.add(fn); }
export function unsubscribe(fn) { listeners.delete(fn); }

/* ---- structural version (increments on add/delete, not position moves) ---- */
let _structVersion = 0;
export function getStructVersion() { return _structVersion; }
export function getBoardSnapshot() { return { ...S }; }

/* ---- debounced persist ---- */
let _saveTimer = null;

function _queueSave() {
  if (!S.board) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    if (S.board) idb.saveBoard(S.board);
  }, DEBOUNCE_MS);
}

export function flushSave() {
  clearTimeout(_saveTimer);
  if (S.board) idb.saveBoard(S.board);
}

/* beforeunload + Ctrl+S */
window.addEventListener('beforeunload', flushSave);
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && S.board) {
    e.preventDefault();
    flushSave();
  }
});

/* ---- board CRUD ---- */

export async function initBoards() {
  S.boards = await idb.listBoards();
  S.ready = true;
  notify();
}

export async function createBoard(name) {
  const board = {
    id: boardId(),
    name: name || 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    camera: { x: 0, y: 0, zoom: 1 },
    renderStyle: 'sketch',
    elements: [],
    groups: {},
  };
  await idb.saveBoard(board);
  S.boards = await idb.listBoards();
  notify();
  return board.id;
}

export async function openBoard(id) {
  flushSave();
  const board = await idb.loadBoard(id);
  if (!board) return;
  S.board = board;
  _structVersion++; // new board = new element set, force spatial index rebuild
  localStorage.setItem('maya_board_lastId', id);
  notify();
  // GC orphaned blobs in background
  idb.deleteOrphanedBlobs(id).catch(() => {});
}

export function closeBoard() {
  flushSave();
  S.board = null;
  S.openTabs = [];
  notify();
}

export async function deleteBoardById(id) {
  await idb.deleteBoard(id);
  // remove from open tabs
  S.openTabs = S.openTabs.filter(t => t.id !== id);
  if (S.board && S.board.id === id) {
    S.board = null;
    localStorage.removeItem('maya_board_lastId');
  }
  S.boards = await idb.listBoards();
  notify();
}

/* ---- multi-board tabs ---- */

export function getOpenTabs() { return S.openTabs; }

/** Open a board as a tab (or switch to it if already open). */
export async function openBoardTab(id) {
  // Already in tabs? Just switch.
  if (S.openTabs.some(t => t.id === id)) {
    await switchTab(id);
    return;
  }
  // Load board
  flushSave();
  const board = await idb.loadBoard(id);
  if (!board) return;
  S.board = board;
  _structVersion++;
  S.openTabs.push({ id: board.id, name: board.name });
  localStorage.setItem('maya_board_lastId', id);
  notify();
  idb.deleteOrphanedBlobs(id).catch(() => {});
}

/** Switch active tab to a different open board. */
export async function switchTab(id) {
  if (S.board && S.board.id === id) return; // already active
  flushSave();
  const board = await idb.loadBoard(id);
  if (!board) return;
  S.board = board;
  _structVersion++;
  localStorage.setItem('maya_board_lastId', id);
  notify();
}

/** Close a tab. Switches to adjacent tab or returns to picker. */
export async function closeBoardTab(id) {
  const idx = S.openTabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  // If closing the active board, flush first
  if (S.board && S.board.id === id) flushSave();
  S.openTabs.splice(idx, 1);
  if (S.openTabs.length === 0) {
    // No tabs left — return to board picker
    S.board = null;
    notify();
    return;
  }
  // Switch to adjacent tab if we closed the active one
  if (S.board && S.board.id === id) {
    const nextIdx = Math.min(idx, S.openTabs.length - 1);
    const next = S.openTabs[nextIdx];
    const board = await idb.loadBoard(next.id);
    if (board) {
      S.board = board;
      _structVersion++;
      localStorage.setItem('maya_board_lastId', next.id);
    } else {
      S.board = null;
    }
  }
  notify();
}

export function renameBoard(id, name) {
  if (S.board && S.board.id === id) {
    S.board.name = name;
  }
  const entry = S.boards.find(b => b.id === id);
  if (entry) entry.name = name;
  // sync tab name
  const tab = S.openTabs.find(t => t.id === id);
  if (tab) tab.name = name;
  _queueSave();
  notify();
}

/* ---- camera ---- */

export function setCamera(cam) {
  if (!S.board) return;
  S.board.camera = cam;
  _queueSave();
  notify();
}

export function getCamera() {
  return S.board ? S.board.camera : { x: 0, y: 0, zoom: 1 };
}

/* ---- render style ---- */

export function setRenderStyle(style) {
  if (!S.board) return;
  S.board.renderStyle = style;
  _queueSave();
  notify();
}

export function getRenderStyle() {
  return S.board ? S.board.renderStyle : 'sketch';
}

/* ---- element CRUD ---- */

export function addElement(el) {
  if (!S.board) return;
  S.board.elements.push(el);
  _structVersion++;
  _queueSave();
  notify();
}

export function updateElement(id, patch) {
  if (!S.board) return;
  const el = S.board.elements.find(e => e.id === id);
  if (!el) return;
  Object.assign(el, patch);
  _queueSave();
  notify();
}

export function updateElements(patches) {
  if (!S.board) return;
  for (const { id, ...patch } of patches) {
    const el = S.board.elements.find(e => e.id === id);
    if (el) Object.assign(el, patch);
  }
  _queueSave();
  notify();
}

export function deleteElement(id) {
  if (!S.board) return;
  S.board.elements = S.board.elements.filter(e => e.id !== id);
  _structVersion++;
  _queueSave();
  notify();
}

export function deleteElements(ids) {
  if (!S.board) return;
  const set = new Set(ids);
  S.board.elements = S.board.elements.filter(e => !set.has(e.id));
  _structVersion++;
  _queueSave();
  notify();
}

/** Mutate element positions without triggering a React notify (used during drag).
 *  The canvas is dirtied via setDirty() by the caller. Call syncNotify() on drag end. */
export function updateElementsSilent(patches) {
  if (!S.board) return;
  for (const { id, ...patch } of patches) {
    const el = S.board.elements.find(e => e.id === id);
    if (el) Object.assign(el, patch);
  }
  _queueSave();
  // deliberately no notify() — avoids React re-renders on every mousemove
}

/** Fire a notify after silent updates complete (call on drag end). */
export function syncNotify() { notify(); }

export function getElement(id) {
  if (!S.board) return null;
  return S.board.elements.find(e => e.id === id) || null;
}

export function getElements() {
  return S.board ? S.board.elements : [];
}

export function getNextZIndex() {
  if (!S.board || S.board.elements.length === 0) return 1;
  return Math.max(...S.board.elements.map(e => e.zIndex || 0)) + 1;
}

/* ---- z-ordering ---- */

export function bringForward(ids) {
  if (!S.board) return;
  const set = new Set(ids);
  const els = S.board.elements;
  const sorted = [...els].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (set.has(sorted[i].id) && !set.has(sorted[i + 1].id)) {
      const tmp = sorted[i].zIndex;
      sorted[i].zIndex = sorted[i + 1].zIndex;
      sorted[i + 1].zIndex = tmp;
    }
  }
  _queueSave(); notify();
}

export function sendBackward(ids) {
  if (!S.board) return;
  const set = new Set(ids);
  const els = S.board.elements;
  const sorted = [...els].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (let i = 1; i < sorted.length; i++) {
    if (set.has(sorted[i].id) && !set.has(sorted[i - 1].id)) {
      const tmp = sorted[i].zIndex;
      sorted[i].zIndex = sorted[i - 1].zIndex;
      sorted[i - 1].zIndex = tmp;
    }
  }
  _queueSave(); notify();
}

export function bringToFront(ids) {
  if (!S.board) return;
  let maxZ = Math.max(0, ...S.board.elements.map(e => e.zIndex || 0));
  for (const id of ids) {
    const el = S.board.elements.find(e => e.id === id);
    if (el) el.zIndex = ++maxZ;
  }
  _queueSave(); notify();
}

export function sendToBack(ids) {
  if (!S.board) return;
  let minZ = Math.min(0, ...S.board.elements.map(e => e.zIndex || 0));
  for (const id of [...ids].reverse()) {
    const el = S.board.elements.find(e => e.id === id);
    if (el) el.zIndex = --minZ;
  }
  _queueSave(); notify();
}

/* ---- groups ---- */

export function getGroups() {
  return S.board ? (S.board.groups || {}) : {};
}

export function setGroups(groups) {
  if (!S.board) return;
  S.board.groups = groups;
  _queueSave(); notify();
}

/* ---- undo/redo apply ---- */

export function applyUndo(cmd) {
  if (!S.board) return;
  if (cmd.type === 'create') {
    // undo create = delete
    const ids = new Set(cmd.elementIds);
    S.board.elements = S.board.elements.filter(e => !ids.has(e.id));
    _structVersion++;
  } else if (cmd.type === 'delete') {
    // undo delete = restore
    for (const snap of cmd.before) {
      S.board.elements.push(JSON.parse(JSON.stringify(snap)));
    }
    _structVersion++;
  } else if (cmd.type === 'move' || cmd.type === 'resize' || cmd.type === 'style') {
    // restore before state
    for (const snap of cmd.before) {
      const el = S.board.elements.find(e => e.id === snap.id);
      if (el) Object.assign(el, snap);
    }
  }
  _queueSave();
  notify();
}

export function applyRedo(cmd) {
  if (!S.board) return;
  if (cmd.type === 'create') {
    // redo create = re-add
    for (const snap of cmd.after) {
      S.board.elements.push(JSON.parse(JSON.stringify(snap)));
    }
    _structVersion++;
  } else if (cmd.type === 'delete') {
    // redo delete = remove again
    const ids = new Set(cmd.elementIds);
    S.board.elements = S.board.elements.filter(e => !ids.has(e.id));
    _structVersion++;
  } else if (cmd.type === 'move' || cmd.type === 'resize' || cmd.type === 'style') {
    for (const snap of cmd.after) {
      const el = S.board.elements.find(e => e.id === snap.id);
      if (el) Object.assign(el, snap);
    }
  }
  _queueSave();
  notify();
}

/* ---- last opened ---- */
export function getLastBoardId() {
  return localStorage.getItem('maya_board_lastId');
}
