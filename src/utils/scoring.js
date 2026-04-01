import { today } from './dates.js';

const TIER_EXP = {
  perfect: 125,  // disproportionate top bonus
  p90:      88,  // 90–99%
  p80:      68,  // 80–89%
  p70:      42,  // 70–79%
  p60:      12,  // 60–69%
  p50:      -8,  // 50–59%
  p40:     -22,  // 40–49%
  p30:     -40,  // 30–39%
  fail:    -70,  // below 30%
};

export const TITLES = [
  'Adrift', 'First Light', 'Trying Anyway', 'In Motion', 'Finding Rhythm',
  'Building', 'Steady Ground', 'Reliable', 'Consistent', 'Committed',
  'Disciplined', 'Sharp Edge', 'Methodical', 'Self-Directed', 'Grounded',
  'Anchored', 'The Long Game', 'Sovereign', 'Trusted', 'Someone Who Returns',
  'Unwavering', 'The Operator', 'Locked In', 'Iron Will', 'Deep Focus',
  'Composed', 'No Days Off', 'Forged', 'Signal Over Noise', 'The Architect',
  'Under Control', 'Full Output', 'The Standard', 'Calibrated', 'Zero Drift',
  'The Discipline', 'Unbroken', 'The Veteran', 'Precision Mode', 'Hardened',
  'The Blueprint', 'Execution Only', 'Deep Work', 'Load-Bearing', 'The Faithful',
  'System Stable', 'The Craftsperson', 'Built Different', 'The Constant', 'Halfway There',
  'Immovable', 'The Marathon', 'Long Arc', 'Still Standing', 'The Proof',
  'Compounding', 'Self-Sustaining', 'Earned Ground', 'Endgame Mode', 'Beyond Habit',
  'The Pillar', 'Deep Root', 'The Institution', 'Years In', 'The Monument',
  'Absolute', 'Living Proof', 'The Summit', 'Untouchable', 'The Authority',
  'Crystalline', 'The Record', 'Unassailable', 'The Archive', 'Irreducible',
  'The Covenant', 'Singular', 'The Ascendant', 'Beyond Measure', 'The Pinnacle',
  'Immutable', 'The Legend', 'System Complete', 'Apex Form', 'Transcendent',
  'The Thesis', 'Undeniable', 'The Final Proof', 'Incorruptible', 'The Reckoning',
  'Pure Signal', 'The Way', 'Decades In', 'What Remains', 'The Infinite Return',
  'Mythic', 'The Living System', 'Eternal Return', 'The Last Level', 'Someone Who Never Stopped'
];

export const expForLevel = n => Math.round(19 * Math.pow(n + 24, 1.15));

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
  else if (frac >= 0.9) tier = 'p90';
  else if (frac >= 0.8) tier = 'p80';
  else if (frac >= 0.7) tier = 'p70';
  else if (frac >= 0.6) tier = 'p60';
  else if (frac >= 0.5) tier = 'p50';
  else if (frac >= 0.4) tier = 'p40';
  else if (frac >= 0.3) tier = 'p30';
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
  while ((profile.level || 1) < 100 && profile.exp >= expForLevel((profile.level || 1) + 1)) {
    profile.exp -= expForLevel(profile.level + 1);
    profile.level++;
    leveled = true;
  }

  profile.momentum = calcMomentum(state);

  return { profile, leveled, tier, gain };
}

export function calcMomentum(state) {
  const order = ['fail', 'p30', 'p40', 'p50', 'p60', 'p70', 'p80', 'p90', 'perfect'];
  const recent = Object.keys(state.days).filter(d => state.days[d]?.closed).sort().slice(-5);
  if (recent.length < 2) return 'stable';
  const avg = recent.map(d => order.indexOf(scoreDay(d, state).tier)).reduce((a, b) => a + b, 0) / recent.length;
  return avg >= 3.5 ? 'rising' : avg <= 1.5 ? 'slipping' : 'stable';
}
