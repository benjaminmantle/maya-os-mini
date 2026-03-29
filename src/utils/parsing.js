// Convert -- followed by any non-hyphen character into an em dash
export function applyEmDash(str) {
  return str.replace(/--([^-])/g, '\u2014$1');
}

export function parseInput(raw) {
  let t = raw.trim(), pts = null, time = '', priority = null;

  // Frog flag
  const isFrog = /\bfrog\b/i.test(t);
  if (isFrog) t = t.replace(/\bfrog\b/gi, '').trim();

  // Priority: !hi/!h/!1, !md/!m/!2, !lo/!l/!3
  const priM = t.match(/!(hi|h|md|m|lo|l|[123])\b/i);
  if (priM) {
    const k = priM[1].toLowerCase();
    priority = (k === 'h' || k === 'hi' || k === '1') ? 'hi'
             : (k === 'm' || k === 'md' || k === '2') ? 'md'
             : 'lo';
    t = t.replace(priM[0], '').trim();
  }

  // Time estimate: 2h, 45m, 2hr, 30min — optional trailing + for open-ended
  const tm = t.match(/\b(\d+)\s*(h(?:r|ours?)?|m(?:in(?:utes?)?)?)(\+)?(?=\s|$)/i);
  if (tm) {
    const unit = tm[2][0].toLowerCase() === 'h' ? `${tm[1]}h` : `${tm[1]}m`;
    time = tm[3] ? unit + '+' : unit;
    t = t.replace(tm[0], '').trim();
  }

  // Points: @0, @0.5, @1, @2, @3
  const dm = t.match(/@(0\.5|[0-3])\b/);
  if (dm) { pts = +dm[1]; t = t.replace(dm[0], '').trim(); }

  return { name: t.replace(/\s+/g, ' ').trim() || 'Untitled', pts: pts ?? 0.5, time, isFrog, priority };
}

// Sum calories from a food log array (handles null/undefined)
export function sumCalories(foodLog) {
  return (foodLog || []).reduce((s, f) => s + (f.cal || 0), 0);
}

// Parse "HH:MM" time string to minutes since midnight
export function timeToMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Parse food input: "chicken breast 300cal" → { name: "chicken breast", cal: 300 }
export function parseFoodInput(raw) {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)\s+(\d+)\s*(c|cal|calories?)$/i);
  if (m) return { name: m[1].trim(), cal: parseInt(m[2], 10) };
  return { name: t, cal: 0 };
}
