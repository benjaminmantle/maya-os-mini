import { moveTask } from '../store/store.js';

// Is this a "special" priority (own sidebar tab, uses task.done, star-rated)?
export function isSpecialPriority(p) { return p === 'maya' || p === 'ai' || p === 'idea'; }

// Priority rank — lower number = higher priority
// maya/ai > hi > md > lo > null
export function priRank(p) {
  return p === 'maya' || p === 'ai' || p === 'idea' ? 0 : p === 'hi' ? 1 : p === 'md' ? 2 : p === 'lo' ? 3 : 4;
}

// Clamp insertAt to the valid zone for `pri` within zoneList (list must NOT include the task)
export function snapToZone(insertAt, zoneList, pri) {
  const rank = priRank(pri);
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = priRank(zoneList[i].priority);
    if (r < rank) lo = i + 1;
    if (r > rank && hi === zoneList.length) hi = i;
  }
  return Math.min(Math.max(insertAt, lo), hi);
}

// Where to insert a task with `pri` in zoneList (list must NOT include the task):
// colored → end of its group; null → top of the null zone (just below last colored task)
export function insertAtForPri(pri, zoneList) {
  const rank = priRank(pri);
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = priRank(zoneList[i].priority);
    if (r < rank) lo = i + 1;
    if (r > rank && hi === zoneList.length) hi = i;
  }
  if (pri === null) return lo;
  return lo + zoneList.slice(lo, hi).filter(t => t.priority === pri).length;
}

// Insert at the TOP of the priority group (for new task creation)
export function insertTopOfGroup(pri, zoneList) {
  const rank = priRank(pri);
  let lo = 0;
  for (let i = 0; i < zoneList.length; i++) {
    if (priRank(zoneList[i].priority) < rank) lo = i + 1;
  }
  return lo;
}

// Effective rank for a task — maya/ai tasks use star count, others use priority string
// 3★ maya/ai → 1 (with hi), 2★ → 2 (with md), 1-0★ → 3 (with lo)
export function taskRank(t) {
  if (t.priority === 'maya' || t.priority === 'ai' || t.priority === 'idea') {
    const s = t.mayaPts ?? 1;
    return s >= 3 ? 1 : s >= 2 ? 2 : 3;
  }
  return priRank(t.priority);
}

// Like snapToZone but uses taskRank on zone items and accepts a rank number directly
export function snapToZoneByRank(insertAt, zoneList, rank) {
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = taskRank(zoneList[i]);
    if (r < rank) lo = i + 1;
    if (r > rank && hi === zoneList.length) hi = i;
  }
  return Math.min(Math.max(insertAt, lo), hi);
}

// Move task `id` to insertAt position within zoneList
export function doMove(id, insertAt, zoneList) {
  if (insertAt < zoneList.length) moveTask(id, zoneList[insertAt].id, true);
  else if (zoneList.length > 0) moveTask(id, zoneList[zoneList.length - 1].id, false);
}

// Insert a maya task at the end of its star group (for star-change repositioning)
// Higher mayaPts = earlier in list (3★ first, 1★ last)
export function insertAtForStars(stars, zoneList) {
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = zoneList[i].mayaPts ?? 1;
    if (r > stars) lo = i + 1;
    if (r < stars && hi === zoneList.length) hi = i;
  }
  return lo + zoneList.slice(lo, hi).filter(t => (t.mayaPts ?? 1) === stars).length;
}
