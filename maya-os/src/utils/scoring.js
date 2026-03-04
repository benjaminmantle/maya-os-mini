import { today } from './dates.js';

const TIER_EXP = { perfect: 100, good: 78, decent: 32, half: -5, poor: -18, fail: -30 };

export const TITLES = [
  'Adrift', 'First Light', 'Trying Anyway', 'In Motion', 'Finding Rhythm',
  'Building', 'Steady Ground', 'Reliable', 'Consistent', 'Committed',
  'Disciplined', 'Sharp Edge', 'Methodical', 'Self-Directed', 'Grounded',
  'Anchored', 'The Long Game', 'Sovereign', 'Trusted', 'Someone Who Returns'
];

export const expForLevel = n => Math.round(200 * Math.pow(1.4, n - 1));

export function scoreDay(d, state) {
  const day = state.days[d] || { cIds: [], dIds: [], closed: false };
  const tgt = state.target;
  const dTot = state.dailies.length;
  const all = state.tasks.filter(t => t.scheduledDate === d);
  const pts = all.filter(t => day.cIds.includes(t.id)).reduce((s, t) => s + (t.pts ?? 1), 0);
  const dDone = day.dIds.length;
  const ptsMissed = Math.max(0, tgt - pts);
  const dMissed = Math.max(0, dTot - dDone);
  const frac = (tgt + dTot) > 0 ? (Math.min(pts, tgt) + dDone) / (tgt + dTot) : 0;
  let tier;
  if (ptsMissed === 0 && dMissed === 0) tier = 'perfect';
  else if ((ptsMissed <= 1 && dMissed === 0) || (ptsMissed === 0 && dMissed <= 1)) tier = 'good';
  else if (frac >= 0.7) tier = 'decent';
  else if (frac >= 0.5) tier = 'half';
  else if (frac >= 0.25) tier = 'poor';
  else tier = 'fail';
  return { tier, pts, dDone, dTot, tgt, frac };
}

export function closeDayScoring(d, state) {
  const { tier } = scoreDay(d, state);
  const base = TIER_EXP[tier];
  const mult = tier === 'perfect' ? Math.min(1 + (state.profile.streak || 0) * 0.05, 1.5) : 1;
  const gain = base > 0 ? Math.round(base * mult) : base;

  const profile = { ...state.profile };
  profile.exp = Math.max(0, (profile.exp || 0) + gain);

  if (tier === 'perfect') {
    profile.streak = (profile.streak || 0) + 1;
    profile.longest = Math.max(profile.longest || 0, profile.streak);
    profile.perfect = (profile.perfect || 0) + 1;
  } else {
    profile.streak = 0;
  }

  let leveled = false;
  while (profile.exp >= expForLevel((profile.level || 1) + 1)) {
    profile.exp -= expForLevel(profile.level + 1);
    profile.level++;
    leveled = true;
  }

  profile.momentum = calcMomentum(state);

  return { profile, leveled, tier, gain };
}

export function calcMomentum(state) {
  const order = ['fail', 'poor', 'half', 'decent', 'good', 'perfect'];
  const recent = Object.keys(state.days).sort().slice(-5);
  if (recent.length < 2) return 'stable';
  const avg = recent.map(d => order.indexOf(scoreDay(d, state).tier)).reduce((a, b) => a + b, 0) / recent.length;
  return avg >= 3.5 ? 'rising' : avg <= 1.5 ? 'slipping' : 'stable';
}
