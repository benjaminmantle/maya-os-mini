import { moveTask } from '../store/store.js';

// Is this a "special" priority? Only ideas — they use task.done, can't be scheduled.
export function isSpecialPriority(p) { return p === 'idea'; }

// Star rank — higher stars = lower rank number = higher priority
// 5★→1, 4★→2, 3★→3, 2★→4, 1★→5
export function starRank(t) {
  const s = t.mayaPts ?? 1;
  return 6 - Math.min(Math.max(s, 1), 5);
}

// Clamp insertAt to the valid zone for a given star count within zoneList
export function snapToStarZone(insertAt, zoneList, stars) {
  const rank = 6 - Math.min(Math.max(stars, 1), 5);
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = starRank(zoneList[i]);
    if (r < rank) lo = i + 1;
    if (r > rank && hi === zoneList.length) hi = i;
  }
  return Math.min(Math.max(insertAt, lo), hi);
}

// Like snapToStarZone but takes a rank number directly
export function snapToZoneByRank(insertAt, zoneList, rank) {
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = starRank(zoneList[i]);
    if (r < rank) lo = i + 1;
    if (r > rank && hi === zoneList.length) hi = i;
  }
  return Math.min(Math.max(insertAt, lo), hi);
}

// Insert at TOP of star group (for new task creation)
export function insertTopOfStarGroup(stars, zoneList) {
  const rank = 6 - Math.min(Math.max(stars, 1), 5);
  let lo = 0;
  for (let i = 0; i < zoneList.length; i++) {
    if (starRank(zoneList[i]) < rank) lo = i + 1;
  }
  return lo;
}

// Insert at END of star group (for star-change repositioning)
// Higher mayaPts = earlier in list (5★ first, 1★ last)
export function insertAtForStars(stars, zoneList) {
  const rank = 6 - Math.min(Math.max(stars, 1), 5);
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = starRank(zoneList[i]);
    if (r < rank) lo = i + 1;
    if (r > rank && hi === zoneList.length) hi = i;
  }
  return lo + zoneList.slice(lo, hi).filter(t => (t.mayaPts ?? 1) === stars).length;
}

// Move task `id` to insertAt position within zoneList
export function doMove(id, insertAt, zoneList) {
  if (insertAt < zoneList.length) moveTask(id, zoneList[insertAt].id, true);
  else if (zoneList.length > 0) moveTask(id, zoneList[zoneList.length - 1].id, false);
}
