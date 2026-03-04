import { closeDayScoring } from '../utils/scoring.js';
import { today } from '../utils/dates.js';
import { parseDurMs } from '../utils/duration.js';
import { DEFAULT_DAILIES, seedTasks } from './defaults.js';
import { migrateV4toV5 } from './migrations.js';

const STORAGE_KEY = 'maya_os_v5';

let S = {
  tasks: [],
  dailies: [],
  days: {},
  profile: { level: 1, exp: 0, streak: 0, longest: 0, perfect: 0, momentum: 'stable' },
  target: 10,
  frogsComplete: {},
};

const listeners = new Set();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: S.tasks,
    dailies: S.dailies,
    days: S.days,
    profile: S.profile,
    target: S.target,
    frogsComplete: S.frogsComplete,
  }));
}

function notify() {
  listeners.forEach(fn => fn());
}

function save() {
  persist();
  notify();
}

// Rename map for dailies fixup (old name → new name)
const DAILY_RENAMES = {
  '5m calisthenics #1': 'Calisthenics 5m #1',
  '5m calisthenics #2': 'Calisthenics 5m #2',
  '5,000 steps': '4,000 steps',
  'Wind down by 10:30 pm': 'Wind down by 11pm',
};

function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const migrated = migrateV4toV5();
      if (migrated) {
        S = { ...S, ...migrated };
        return;
      }
      return;
    }
    const d = JSON.parse(raw);
    if (d.tasks) S.tasks = d.tasks;
    if (d.dailies) S.dailies = d.dailies;
    if (d.days) S.days = d.days;
    if (d.profile) S.profile = d.profile;
    if (d.target) S.target = d.target;
    if (d.frogsComplete) S.frogsComplete = d.frogsComplete;
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}

// Initialize
load();
if (!S.dailies.length) S.dailies = DEFAULT_DAILIES;
if (!S.tasks.length) {
  S.tasks = seedTasks();
  persist();
}

// One-time dailies rename fixup (runs on every load, no-ops after first rename)
if (S.dailies.length) {
  let changed = false;
  S.dailies.forEach(d => {
    if (DAILY_RENAMES[d.name]) { d.name = DAILY_RENAMES[d.name]; changed = true; }
  });
  if (changed) persist();
}

// --- Getters ---

export function getState() {
  return { ...S, tasks: [...S.tasks], days: { ...S.days } };
}

export function getTasks() {
  return S.tasks;
}

export function getTasksForDate(date) {
  return S.tasks.filter(t => t.scheduledDate === date);
}

export function getDailies() {
  return S.dailies;
}

export function getDayRecord(date) {
  if (!S.days[date]) S.days[date] = { cIds: [], dIds: [], closed: false, workout: false };
  if (S.days[date].workout === undefined) S.days[date].workout = false;
  return S.days[date];
}

export function getProfile() {
  return S.profile;
}

export function getTarget() {
  return S.target;
}

export function getFrogsComplete(date) {
  return !!S.frogsComplete[date];
}

// --- Mutators ---

export function saveTask(task) {
  const idx = S.tasks.findIndex(t => t.id === task.id);
  if (idx === -1) S.tasks.unshift(task);
  else S.tasks[idx] = task;
  save();
}

export function deleteTask(id) {
  S.tasks = S.tasks.filter(t => t.id !== id);
  save();
}

export function updateTask(id, patch) {
  const t = S.tasks.find(t => t.id === id);
  if (t) {
    Object.assign(t, patch);
    save();
  }
}

export function markTaskComplete(taskId, date, done) {
  const day = getDayRecord(date);
  const idx = day.cIds.indexOf(taskId);
  if (done && idx === -1) day.cIds.push(taskId);
  if (!done && idx !== -1) day.cIds.splice(idx, 1);
  save();
}

// Move a task before or after another task in the array (for drag-to-reorder)
export function moveTask(draggedId, targetId, before) {
  const from = S.tasks.findIndex(t => t.id === draggedId);
  if (from === -1) return;
  const [task] = S.tasks.splice(from, 1);
  let to = S.tasks.findIndex(t => t.id === targetId);
  if (to === -1) S.tasks.push(task);
  else S.tasks.splice(before ? to : to + 1, 0, task);
  save();
}

// Permanently sort a subset of tasks (by date for day view, or null for backlog)
export function sortTasksForView(date, field, dir) {
  const match = date === null
    ? (t) => !t.scheduledDate
    : (t) => t.scheduledDate === date && !t.isFrog;
  const indices = [];
  const slice = [];
  S.tasks.forEach((t, i) => {
    if (match(t)) { indices.push(i); slice.push(t); }
  });
  slice.sort((a, b) => {
    if (field === 'pts') {
      return dir === 'asc'
        ? (a.pts ?? 1) - (b.pts ?? 1)
        : (b.pts ?? 1) - (a.pts ?? 1);
    }
    // dur — null durations sort to end regardless of direction
    const av = parseDurMs(a.timeEstimate);
    const bv = parseDurMs(b.timeEstimate);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir === 'asc' ? av - bv : bv - av;
  });
  indices.forEach((idx, i) => { S.tasks[idx] = slice[i]; });
  save();
}

export function saveDailies(dailies) {
  S.dailies = dailies;
  save();
}

export function saveDaily(daily) {
  const idx = S.dailies.findIndex(d => d.id === daily.id);
  if (idx === -1) S.dailies.push(daily);
  else S.dailies[idx] = daily;
  save();
}

export function deleteDaily(id) {
  S.dailies = S.dailies.filter(d => d.id !== id);
  Object.values(S.days).forEach(day => {
    const i = day.dIds.indexOf(id);
    if (i !== -1) day.dIds.splice(i, 1);
  });
  save();
}

export function markDailyComplete(dailyId, date, done) {
  const day = getDayRecord(date);
  const idx = day.dIds.indexOf(dailyId);
  if (done && idx === -1) day.dIds.push(dailyId);
  if (!done && idx !== -1) day.dIds.splice(idx, 1);
  save();
}

// Reverse a score record that was stored when the day was closed.
// This restores the profile to its pre-close state.
function reverseScoreRecord(record) {
  const p = S.profile;
  p.exp = Math.max(0, (p.exp || 0) - record.expDelta);
  if (record.streakIncremented) {
    p.streak = Math.max(0, (p.streak || 0) - 1);
  }
  p.longest = record.longestBefore;
  p.perfect = Math.max(0, (p.perfect || 0) - record.perfectDelta);
}

export function closeDay(date) {
  const day = getDayRecord(date);
  // If this day was previously scored (e.g. reopen → re-close), reverse the
  // prior scoring first so we don't double-count XP / streaks.
  if (day.scoreRecord) {
    reverseScoreRecord(day.scoreRecord);
    day.scoreRecord = null;
  }
  const longestBefore = S.profile.longest || 0;
  const result = closeDayScoring(date, S);
  // Store the delta so it can be reversed cleanly on reopen.
  day.scoreRecord = {
    expDelta: result.gain,
    streakIncremented: result.tier === 'perfect',
    longestBefore,
    perfectDelta: result.tier === 'perfect' ? 1 : 0,
  };
  S.profile = result.profile;
  day.closed = true;
  save();
  return result;
}

export function reopenDay(date) {
  const day = getDayRecord(date);
  // Reverse the XP/streak that was applied when this day was closed.
  if (day.scoreRecord) {
    reverseScoreRecord(day.scoreRecord);
    day.scoreRecord = null;
  }
  day.closed = false;
  save();
}

export function setTarget(n) {
  S.target = n;
  save();
}

export function setFrogsComplete(date, done) {
  S.frogsComplete[date] = done;
  save();
}

export function exportData() {
  return JSON.stringify({
    version: 'maya_os_v5',
    tasks: S.tasks,
    dailies: S.dailies,
    days: S.days,
    profile: S.profile,
    target: S.target,
    frogsComplete: S.frogsComplete,
  }, null, 2);
}

export function importData(json) {
  try {
    const d = JSON.parse(json);
    // Accept both versioned exports and raw state objects
    if (d.tasks !== undefined) S.tasks = d.tasks;
    if (d.dailies !== undefined) S.dailies = d.dailies;
    if (d.days !== undefined) S.days = d.days;
    if (d.profile !== undefined) S.profile = d.profile;
    if (d.target !== undefined) S.target = d.target;
    if (d.frogsComplete !== undefined) S.frogsComplete = d.frogsComplete;
    save();
    return true;
  } catch (e) {
    return false;
  }
}

export function toggleWorkout(date) {
  if (!S.days[date]) S.days[date] = { cIds: [], dIds: [], closed: false, workout: false };
  if (S.days[date].workout === undefined) S.days[date].workout = false;
  S.days[date].workout = !S.days[date].workout;
  save();
}

export function resetToday() {
  S.days[today()] = { cIds: [], dIds: [], closed: false, workout: false };
  save();
}

export function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

export function subscribe(fn) {
  listeners.add(fn);
}

export function unsubscribe(fn) {
  listeners.delete(fn);
}
