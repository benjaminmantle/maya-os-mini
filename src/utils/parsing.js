// Convert -- followed by any non-hyphen character into an em dash
export function applyEmDash(str) {
  return str.replace(/--([^-])/g, '\u2014$1');
}

export function parseInput(raw, projects) {
  let t = raw.trim(), pts = null, time = '', stars = null, project = null;

  // Frog flag
  const isFrog = /\bfrog\b/i.test(t);
  if (isFrog) t = t.replace(/\bfrog\b/gi, '').trim();

  // Stars: !1 through !5 (number = star count)
  const starM = t.match(/!([1-5])\b/);
  if (starM) {
    stars = +starM[1];
    t = t.replace(starM[0], '').trim();
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

  // Project: #ProjectName (case-insensitive match against existing projects)
  if (projects && projects.length) {
    const pm = t.match(/#(\S+)/);
    if (pm) {
      const match = projects.find(p => p.name.toLowerCase() === pm[1].toLowerCase());
      if (match) {
        project = match.name;
        t = t.replace(pm[0], '').trim();
      }
    }
  }

  return { name: t.replace(/\s+/g, ' ').trim() || 'Untitled', pts: pts ?? 0.5, time, isFrog, stars, project };
}

// Idea-only parser: extracts star rating and name only (no pts/duration/frog)
export function parseIdeaInput(raw) {
  let t = raw.trim(), stars = null;
  const starM = t.match(/!([1-5])\b/);
  if (starM) {
    stars = +starM[1];
    t = t.replace(starM[0], '').trim();
  }
  return { name: t.replace(/\s+/g, ' ').trim() || 'Untitled', stars };
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
