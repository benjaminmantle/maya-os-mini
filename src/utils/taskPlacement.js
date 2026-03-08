import { moveTask } from '../store/store.js';

// Priority rank — lower number = higher priority
// maya > hi > md > lo > null
export function priRank(p) {
  return p === 'maya' ? 0 : p === 'hi' ? 1 : p === 'md' ? 2 : p === 'lo' ? 3 : 4;
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

// Move task `id` to insertAt position within zoneList
export function doMove(id, insertAt, zoneList) {
  if (insertAt < zoneList.length) moveTask(id, zoneList[insertAt].id, true);
  else if (zoneList.length > 0) moveTask(id, zoneList[zoneList.length - 1].id, false);
}
