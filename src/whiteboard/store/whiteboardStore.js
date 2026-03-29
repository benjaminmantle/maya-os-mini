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
    ready: false,
  };
}
const S = window.__boardS;

function notify() { listeners.forEach(fn => fn()); }
export function subscribe(fn)   { listeners.add(fn); }
export function unsubscribe(fn) { listeners.delete(fn); }
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
  localStorage.setItem('maya_board_lastId', id);
  notify();
  // GC orphaned blobs in background
  idb.deleteOrphanedBlobs(id).catch(() => {});
}

export function closeBoard() {
  flushSave();
  S.board = null;
  notify();
}

export async function deleteBoardById(id) {
  await idb.deleteBoard(id);
  if (S.board && S.board.id === id) {
    S.board = null;
    localStorage.removeItem('maya_board_lastId');
  }
  S.boards = await idb.listBoards();
  notify();
}

export function renameBoard(id, name) {
  if (S.board && S.board.id === id) {
    S.board.name = name;
  }
  const entry = S.boards.find(b => b.id === id);
  if (entry) entry.name = name;
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
  _queueSave();
  notify();
}

export function deleteElements(ids) {
  if (!S.board) return;
  const set = new Set(ids);
  S.board.elements = S.board.elements.filter(e => !set.has(e.id));
  _queueSave();
  notify();
}

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

/* ---- last opened ---- */
export function getLastBoardId() {
  return localStorage.getItem('maya_board_lastId');
}
