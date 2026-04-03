import { closeDayScoring, expForLevel } from '../utils/scoring.js';
import { today, uid } from '../utils/dates.js';
import { parseDurMs } from '../utils/duration.js';
import { timeToMins } from '../utils/parsing.js';
import { DEFAULT_DAILIES, seedTasks } from './defaults.js';
import { migrateV4toV5, migrateV5toV6 } from './migrations.js';

const STORAGE_KEY = 'maya_os_v6';

// Persist S on window so Vite HMR module re-evaluation doesn't reset in-memory state
if (!window.__mayaS) window.__mayaS = {
  tasks: [],
  dailies: [],
  days: {},
  profile: { level: 1, exp: 0, streak: 0, longest: 0, perfect: 0, momentum: 'stable' },
  target: 10,
  frogsComplete: {},
  settings: { fastStart: '13:00', fastEnd: '21:00', calorieTarget: 2000, fastingEnabled: false, caloriesEnabled: false, frogsEnabled: true, ideaTopics: [], projects: [] },
};
let S = window.__mayaS;

// Persist listeners on window so Vite HMR module re-evaluation doesn't wipe them
if (!window.__mayaListeners) window.__mayaListeners = new Set();
const listeners = window.__mayaListeners;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: S.tasks,
    dailies: S.dailies,
    days: S.days,
    profile: S.profile,
    target: S.target,
    frogsComplete: S.frogsComplete,
    settings: S.settings,
  }));
}

function notify() {
  listeners.forEach(fn => fn());
}

function save() {
  persist();
  notify();
}


function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try v5 → v6 migration first, then v4 → v5
      const migrated = migrateV5toV6();
      if (migrated) {
        S = { ...S, ...migrated };
        return;
      }
      const migratedV4 = migrateV4toV5();
      if (migratedV4) {
        migratedV4.settings = { fastStart: '13:00', fastEnd: '21:00', calorieTarget: 2000, fastingEnabled: false, caloriesEnabled: false, frogsEnabled: true, ideaTopics: [], projects: [] };
        S = { ...S, ...migratedV4 };
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
    if (d.settings) S.settings = d.settings;
    // Ensure settings defaults exist
    if (!S.settings) S.settings = { fastStart: '13:00', fastEnd: '21:00', calorieTarget: 2000, fastingEnabled: false, caloriesEnabled: false, frogsEnabled: true, ideaTopics: [], projects: [] };
    if (!S.settings.fastStart) S.settings.fastStart = '13:00';
    if (!S.settings.fastEnd) S.settings.fastEnd = '21:00';
    if (!S.settings.calorieTarget) S.settings.calorieTarget = 2000;
    // fastingEnabled and caloriesEnabled default to false (undefined is falsy, fine)
    // frogsEnabled defaults to true (undefined → true via ?? in getters)
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}

// Initialize
load();

// ── One-time XP replay: recalculate profile from scratch using new 9-tier scoring ──
// Runs once (xpVersion < 2). Replays all closed days in chronological order,
// preserving habit bonuses. Only touches profile.{exp, level, streak, longest, perfect}.
// Tasks, dailies, days, and all historical data are read-only.
function replayProfileFromHistory() {
  const closedDates = Object.keys(S.days).filter(d => S.days[d]?.closed).sort();
  if (closedDates.length === 0) return;

  let profile = { level: 1, exp: 0, streak: 0, longest: 0, perfect: 0, momentum: 'stable' };

  for (const date of closedDates) {
    const day = S.days[date];
    const mockState = { ...S, profile };
    const result = closeDayScoring(date, mockState);

    // Habit bonuses (past dates always past the fasting window)
    let habitBonus = 0;
    if (day.workout) habitBonus += 8;
    if (S.settings.fastingEnabled && !day.fastBroken) habitBonus += 8;
    if (habitBonus > 0) {
      result.profile.exp = Math.max(0, result.profile.exp + habitBonus);
      while (result.profile.level < 100 && result.profile.exp >= expForLevel(result.profile.level + 1)) {
        result.profile.exp -= expForLevel(result.profile.level + 1);
        result.profile.level++;
      }
    }

    profile = result.profile;
  }

  profile.momentum = S.profile.momentum;
  profile.xpVersion = 2;
  S.profile = profile;
  persist(); // Write corrected profile; no notify (pre-React-mount)
}

if (!S.profile.xpVersion || S.profile.xpVersion < 2) {
  replayProfileFromHistory();
}

// Migrate string-based ideaTopics to objects (if present from older version)
if (S.settings.ideaTopics?.length && typeof S.settings.ideaTopics[0] === 'string') {
  S.settings.ideaTopics = S.settings.ideaTopics.map(t => ({ name: t, color: 'slv' }));
}
// Ensure projects array exists
if (!S.settings.projects) S.settings.projects = [];

// ── Migration: maya/ai → normal tasks with project field, hi/md/lo → stars ──
(function migrateTaskSystem() {
  let needsSave = false;
  const projectNames = new Set((S.settings.projects || []).map(p => p.name.toLowerCase()));

  S.tasks.forEach(t => {
    // Migrate maya tasks → normal + project
    if (t.priority === 'maya') {
      const projName = t.project || 'Maya OS';
      t.project = projName;
      t.priority = null;
      t.mayaPts = t.mayaPts ?? 1;
      if (t.name && t.name.startsWith('MAYA \u2014 ')) t.name = t.name.slice(7);
      // If task was done via task.done, sync to cIds
      if (t.done && t.scheduledDate) {
        const day = S.days[t.scheduledDate];
        if (day && !day.cIds.includes(t.id)) day.cIds.push(t.id);
      }
      delete t.done;
      delete t._autoScheduled;
      if (!projectNames.has(projName.toLowerCase())) {
        S.settings.projects.push({ name: projName, color: 'pur' });
        projectNames.add(projName.toLowerCase());
      }
      needsSave = true;
    }
    // Migrate ai tasks → normal + project
    if (t.priority === 'ai') {
      const projName = t.project || 'AI';
      t.project = projName;
      t.priority = null;
      t.mayaPts = t.mayaPts ?? 1;
      if (t.done && t.scheduledDate) {
        const day = S.days[t.scheduledDate];
        if (day && !day.cIds.includes(t.id)) day.cIds.push(t.id);
      }
      delete t.done;
      delete t._autoScheduled;
      if (!projectNames.has(projName.toLowerCase())) {
        S.settings.projects.push({ name: projName, color: 'blu' });
        projectNames.add(projName.toLowerCase());
      }
      needsSave = true;
    }
    // Migrate hi/md/lo → stars
    if (t.priority === 'hi') { t.mayaPts = 5; t.priority = null; needsSave = true; }
    if (t.priority === 'md') { t.mayaPts = 3; t.priority = null; needsSave = true; }
    if (t.priority === 'lo') { t.mayaPts = 1; t.priority = null; needsSave = true; }
    // Ensure all non-idea tasks have mayaPts
    if (t.priority !== 'idea' && !t.mayaPts) { t.mayaPts = 1; needsSave = true; }
  });

  if (needsSave) persist();
})();

if (!S.dailies.length) S.dailies = DEFAULT_DAILIES;
if (!S.tasks.length) {
  S.tasks = seedTasks();
}


// --- Getters ---

export function getState() {
  return { ...S, tasks: [...S.tasks], days: { ...S.days }, settings: { ...S.settings } };
}

export function getDayRecord(date) {
  if (!S.days[date]) S.days[date] = { cIds: [], dIds: [], closed: false, workout: false };
  if (S.days[date].workout === undefined) S.days[date].workout = false;
  return S.days[date];
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

// Ideas use task.done as completion flag (they can't be scheduled to days).
export function markSpecialDone(taskId, done) {
  const task = S.tasks.find(t => t.id === taskId);
  if (!task || task.priority !== 'idea') return;
  task.done = done;
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

// Permanently sort a subset of tasks.
// filter: 'backlog' = unscheduled non-idea; 'proj' = unscheduled with project; 'idea' = unscheduled ideas.
// date string = tasks for that date. specialPri: 'idea' | 'proj' | false.
export function sortTasksForView(date, field, dir, specialPri = false) {
  const match = date === null
    ? specialPri === 'idea'
      ? (t) => !t.scheduledDate && t.priority === 'idea'
      : specialPri === 'proj'
      ? (t) => !t.scheduledDate && t.priority !== 'idea' && t.project
      : (t) => !t.scheduledDate && t.priority !== 'idea'
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
    if (field === 'mgrp') {
      // Sort by star group: 5★ → 1★ (desc = highest stars first)
      return dir === 'desc'
        ? (b.mayaPts ?? 1) - (a.mayaPts ?? 1)
        : (a.mayaPts ?? 1) - (b.mayaPts ?? 1);
    }
    if (field === 'topic') {
      const at = a.topic || '';
      const bt = b.topic || '';
      if (!at && !bt) return 0;
      if (!at) return 1;
      if (!bt) return -1;
      return dir === 'asc' ? at.localeCompare(bt) : bt.localeCompare(at);
    }
    if (field === 'proj') {
      const ap = a.project || '';
      const bp = b.project || '';
      if (!ap && !bp) return 0;
      if (!ap) return 1;
      if (!bp) return -1;
      return dir === 'asc' ? ap.localeCompare(bp) : bp.localeCompare(ap);
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
  // New records store expBefore/levelBefore for exact reversal (handles level-ups correctly).
  // Old records fall back to the delta approach.
  if (record.expBefore !== undefined) {
    p.exp = record.expBefore;
    p.level = record.levelBefore;
  } else {
    p.exp = Math.max(0, (p.exp || 0) - record.expDelta);
  }
  if (record.streakBefore !== undefined) {
    p.streak = record.streakBefore;
  } else if (record.streakIncremented) {
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
  const streakBefore = S.profile.streak || 0;
  // Snapshot exp/level before scoring so reopen can restore them exactly,
  // even if a level-up occurred (level-up consumes exp, making the delta wrong).
  const expBefore = S.profile.exp || 0;
  const levelBefore = S.profile.level || 1;
  const result = closeDayScoring(date, S);

  // Bonus XP for habits (workout + fasting) — additive, doesn't affect tier
  let habitBonus = 0;
  if (day.workout) habitBonus += 8;
  if (S.settings.fastingEnabled && !day.fastBroken && isFastWindowPassed(date)) habitBonus += 8;
  if (habitBonus > 0) {
    result.gain += habitBonus;
    result.profile.exp = Math.max(0, (result.profile.exp || 0) + habitBonus);
    // Re-check leveling after bonus
    while ((result.profile.level || 1) < 100 && result.profile.exp >= expForLevel((result.profile.level || 1) + 1)) {
      result.profile.exp -= expForLevel(result.profile.level + 1);
      result.profile.level++;
      result.leveled = true;
    }
  }

  day.scoreRecord = {
    expDelta: result.gain,
    expBefore,
    levelBefore,
    streakBefore,
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
    version: 'maya_os_v6',
    tasks: S.tasks,
    dailies: S.dailies,
    days: S.days,
    profile: S.profile,
    target: S.target,
    frogsComplete: S.frogsComplete,
    settings: S.settings,
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
    if (d.settings !== undefined) S.settings = d.settings;
    save();
    return true;
  } catch (e) {
    return false;
  }
}

export function exportTasks() {
  const completedIds = new Set(Object.values(S.days).flatMap(d => d.cIds || []));
  const unfinished = S.tasks.filter(t => !completedIds.has(t.id));
  return JSON.stringify({ version: 'maya_os_tasks_v2', tasks: unfinished, dailies: S.dailies }, null, 2);
}

export function importTasks(json) {
  try {
    const d = JSON.parse(json);
    if (!Array.isArray(d.tasks)) return false;
    const now = new Date().toISOString();
    const incoming = d.tasks.map(t => ({ ...t, id: uid(), createdAt: now }));
    S.tasks = [...S.tasks, ...incoming];
    // Restore dailies if present in the export (v2+); absent in old exports — leave unchanged
    if (Array.isArray(d.dailies)) S.dailies = d.dailies;
    save();
    return incoming.length;
  } catch (e) {
    return false;
  }
}

export function carryForwardTasks(toDate) {
  const todayStr = today();
  let count = 0;
  S.tasks = S.tasks.map(t => {
    if (!t.scheduledDate) return t;
    if (t.scheduledDate >= todayStr) return t;  // only past dates
    if (t.priority === 'idea') {
      if (t.done) return t; // idea completion is task.done
    } else {
      const dayRec = S.days[t.scheduledDate];
      if (dayRec && dayRec.cIds.includes(t.id)) return t; // already done
    }
    count++;
    return { ...t, scheduledDate: toDate };
  });
  if (count > 0) save();
  return count;
}

export function toggleWorkout(date) {
  const day = getDayRecord(date);
  day.workout = !day.workout;
  save();
}

export function toggleFastBroken(date) {
  const day = getDayRecord(date);
  day.fastBroken = !day.fastBroken;
  save();
}

export function getFastingSettings() {
  return { fastStart: S.settings.fastStart, fastEnd: S.settings.fastEnd };
}

export function setFastingSettings(start, end) {
  if (/^\d{2}:\d{2}$/.test(start)) S.settings.fastStart = start;
  if (/^\d{2}:\d{2}$/.test(end)) S.settings.fastEnd = end;
  save();
}

// Check if the eating window has fully passed for a given date.
// For past dates: always true (window already passed).
// For today: true only if current time > fastEnd.
// For future dates: false.
export function isFastWindowPassed(date) {
  const todayStr = today();
  if (date < todayStr) return true;
  if (date > todayStr) return false;
  // Today — compare current time to fastEnd
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  return nowM >= timeToMins(S.settings.fastEnd);
}

// ── Food log ─────────────────────────────────────────────────────────────
export function addFoodItem(date, name, cal) {
  const day = getDayRecord(date);
  if (!day.foodLog) day.foodLog = [];
  day.foodLog.push({ id: uid(), name, cal: cal || 0 });
  save();
}

export function updateFoodItem(date, id, patch) {
  const day = getDayRecord(date);
  if (!day.foodLog) return;
  const item = day.foodLog.find(f => f.id === id);
  if (item) { Object.assign(item, patch); save(); }
}

export function deleteFoodItem(date, id) {
  const day = getDayRecord(date);
  if (!day.foodLog) return;
  day.foodLog = day.foodLog.filter(f => f.id !== id);
  save();
}

export function toggleFoodDone(date) {
  const day = getDayRecord(date);
  day.foodDone = !day.foodDone;
  save();
}

export function getCalorieTarget() {
  return S.settings.calorieTarget || 2000;
}

export function setCalorieTarget(n) {
  S.settings.calorieTarget = n;
  save();
}

export function toggleFastingEnabled() {
  S.settings.fastingEnabled = !S.settings.fastingEnabled;
  save();
}

export function toggleCaloriesEnabled() {
  S.settings.caloriesEnabled = !S.settings.caloriesEnabled;
  save();
}

export function toggleFrogsEnabled() {
  S.settings.frogsEnabled = !(S.settings.frogsEnabled ?? true);
  save();
}

// ── Idea topics ─────────────────────────────────────────────────────────
// Topics are { name: string, color: string } objects. Color is a CSS token name (e.g. 'blu', 'ora').

function migrateIdeaTopics() {
  if (!S.settings.ideaTopics || !S.settings.ideaTopics.length) return;
  // Migrate old string-based topics to objects
  if (typeof S.settings.ideaTopics[0] === 'string') {
    S.settings.ideaTopics = S.settings.ideaTopics.map(t => ({ name: t, color: 'slv' }));
  }
}

export function getIdeaTopics() {
  return S.settings.ideaTopics || [];
}

export function addIdeaTopic(name, color) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (!S.settings.ideaTopics) S.settings.ideaTopics = [];
  migrateIdeaTopics();
  const exists = S.settings.ideaTopics.some(t => t.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) return false;
  S.settings.ideaTopics.push({ name: trimmed, color: color || 'slv' });
  save();
  return true;
}

export function editIdeaTopic(oldName, newName) {
  const trimmed = newName.trim();
  if (!trimmed || !S.settings.ideaTopics) return;
  migrateIdeaTopics();
  const topic = S.settings.ideaTopics.find(t => t.name.toLowerCase() === oldName.toLowerCase());
  if (!topic) return;
  topic.name = trimmed;
  S.tasks.forEach(t => {
    if (t.priority === 'idea' && t.topic && t.topic.toLowerCase() === oldName.toLowerCase()) {
      t.topic = trimmed;
    }
  });
  save();
}

export function deleteIdeaTopic(name) {
  if (!S.settings.ideaTopics) return;
  migrateIdeaTopics();
  S.settings.ideaTopics = S.settings.ideaTopics.filter(t => t.name.toLowerCase() !== name.toLowerCase());
  S.tasks.forEach(t => {
    if (t.priority === 'idea' && t.topic && t.topic.toLowerCase() === name.toLowerCase()) {
      t.topic = null;
    }
  });
  save();
}

export function setIdeaTopicColor(name, color) {
  if (!S.settings.ideaTopics) return;
  migrateIdeaTopics();
  const topic = S.settings.ideaTopics.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (topic) { topic.color = color; save(); }
}

// ── Projects ────────────────────────────────────────────────────────────
// Projects are { name: string, color: string } objects. Color is a CSS token name.

export function getProjects() {
  return S.settings.projects || [];
}

export function addProject(name, color) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (!S.settings.projects) S.settings.projects = [];
  const exists = S.settings.projects.some(p => p.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) return false;
  S.settings.projects.push({ name: trimmed, color: color || 'slv' });
  save();
  return true;
}

export function editProject(oldName, newName) {
  const trimmed = newName.trim();
  if (!trimmed || !S.settings.projects) return;
  const proj = S.settings.projects.find(p => p.name.toLowerCase() === oldName.toLowerCase());
  if (!proj) return;
  proj.name = trimmed;
  S.tasks.forEach(t => {
    if (t.project && t.project.toLowerCase() === oldName.toLowerCase()) {
      t.project = trimmed;
    }
  });
  save();
}

export function deleteProject(name) {
  if (!S.settings.projects) return;
  S.settings.projects = S.settings.projects.filter(p => p.name.toLowerCase() !== name.toLowerCase());
  S.tasks.forEach(t => {
    if (t.project && t.project.toLowerCase() === name.toLowerCase()) {
      t.project = null;
    }
  });
  save();
}

export function setProjectColor(name, color) {
  if (!S.settings.projects) return;
  const proj = S.settings.projects.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (proj) { proj.color = color; save(); }
}

export function moveProject(name, direction) {
  if (!S.settings.projects) return;
  const arr = S.settings.projects;
  const idx = arr.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return;
  const item = arr[idx];
  arr.splice(idx, 1);
  if (direction === 'up' && idx > 0) arr.splice(idx - 1, 0, item);
  else if (direction === 'down') arr.splice(Math.min(idx + 1, arr.length), 0, item);
  else if (direction === 'top') arr.unshift(item);
  else if (direction === 'bottom') arr.push(item);
  else arr.splice(idx, 0, item); // no-op fallback
  save();
}

export function moveIdeaTopic(name, direction) {
  if (!S.settings.ideaTopics) return;
  const arr = S.settings.ideaTopics;
  const idx = arr.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return;
  const item = arr[idx];
  arr.splice(idx, 1);
  if (direction === 'up' && idx > 0) arr.splice(idx - 1, 0, item);
  else if (direction === 'down') arr.splice(Math.min(idx + 1, arr.length), 0, item);
  else if (direction === 'top') arr.unshift(item);
  else if (direction === 'bottom') arr.push(item);
  else arr.splice(idx, 0, item);
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
