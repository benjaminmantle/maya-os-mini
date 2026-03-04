import { useState, useRef } from 'react';
import styles from '../../styles/components/StatsView.module.css';
import { TITLES, scoreDay, expForLevel } from '../../utils/scoring.js';
import { todColor } from '../../utils/colors.js';
import { today, addDays } from '../../utils/dates.js';
import { setTarget, exportData, importData, resetToday, clearAll } from '../../store/store.js';
import { useToast } from '../shared/Toast.jsx';

// Tier → neon color for heatmap and bar chart
const TIER_CLR = {
  perfect: 'var(--gold)',
  good: 'var(--grn)',
  decent: 'var(--tel)',
  half: 'var(--slv)',
  poor: 'rgba(255,48,96,0.5)',
  fail: 'var(--hot)',
};

const TIER_LEGEND = [
  ['perfect', 'var(--gold)'],
  ['good', 'var(--grn)'],
  ['decent', 'var(--tel)'],
  ['half', 'var(--slv)'],
  ['poor', 'rgba(255,48,96,0.5)'],
  ['fail', 'var(--hot)'],
];

export default function StatsView({ profile, dailies, days, target: currentTarget, tasks }) {
  const [targetVal, setTargetVal] = useState(currentTarget);
  const fileRef = useRef(null);
  const showToast = useToast();

  const level = profile.level || 1;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
  const dayKeys = Object.keys(days).sort();
  const todayStr = today();
  const pastDayKeys = dayKeys.filter(dk => dk <= todayStr);
  const n = dailies.length;

  // Shared fake-state for scoreDay — keeps scoring logic in one place
  const fakeState = { days, tasks: tasks || [], dailies, target: currentTarget };

  // ── XP progress bar ─────────────────────────────────────────────────────
  const xpCurrent = profile.exp || 0;
  const xpToNext = expForLevel(level + 1);
  const xpPct = Math.min(100, Math.round(xpCurrent / xpToNext * 100));
  const nextTitle = level < TITLES.length ? TITLES[level] : null;

  // ── Frog completions ─────────────────────────────────────────────────────
  const frogsCompleted = pastDayKeys.reduce((total, dk) => {
    return total + (days[dk]?.cIds || []).filter(tid =>
      (tasks || []).find(x => x.id === tid)?.isFrog
    ).length;
  }, 0);

  // ── Average pts per tracked day ──────────────────────────────────────────
  const totalPtsSum = pastDayKeys.reduce((total, dk) => {
    return total + (days[dk]?.cIds || []).reduce((s, tid) => {
      const t = (tasks || []).find(x => x.id === tid);
      return s + (t ? (t.pts ?? 1) : 1);
    }, 0);
  }, 0);
  const avgPts = pastDayKeys.length > 0 ? (totalPtsSum / pastDayKeys.length).toFixed(1) : '—';

  // ── Workout stats ────────────────────────────────────────────────────────
  const totalWorkouts = pastDayKeys.filter(dk => days[dk]?.workout).length;
  let workoutStreak = 0;
  for (const dk of [...pastDayKeys].reverse()) {
    if (days[dk]?.workout) workoutStreak++;
    else break;
  }

  // ── Heatmap: 13 weeks × 7 days (Mon–Sun columns) ────────────────────────
  const dow = new Date(todayStr + 'T12:00:00').getDay(); // 0=Sun
  const currentMonday = addDays(todayStr, dow === 0 ? -6 : 1 - dow);
  const heatStart = addDays(currentMonday, -12 * 7);     // 13 weeks back
  const heatGrid = Array.from({ length: 13 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(heatStart, wi * 7 + di))
  );

  function getHeatColor(date) {
    if (date > todayStr) return 'future';
    const day = days[date];
    if (!day || (!day.cIds?.length && !day.dIds?.length && !day.workout)) return null;
    return TIER_CLR[scoreDay(date, fakeState).tier];
  }

  // ── 30-day bar chart ─────────────────────────────────────────────────────
  const barStart = addDays(todayStr, -29);
  const barData = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(todayStr, -(29 - i));
    const day = days[date];
    if (!day || (!day.cIds?.length && !day.dIds?.length)) return { date, pct: 0, tier: null };
    const { tier, pts } = scoreDay(date, fakeState);
    const pct = currentTarget > 0 ? Math.min(100, Math.round(pts / currentTarget * 100)) : 0;
    return { date, pct, tier };
  });

  // ── Per-daily stats ──────────────────────────────────────────────────────
  const dailyStats = dailies.map((d, i) => {
    const col = todColor(i, n);
    const daysWithData = dayKeys.filter(dk => dk <= todayStr);
    const total = daysWithData.length;
    const done = daysWithData.filter(dk => days[dk]?.dIds?.includes(d.id)).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    let streak = 0;
    for (const dk of [...daysWithData].reverse()) {
      if (days[dk]?.dIds?.includes(d.id)) streak++;
      else break;
    }
    const barCol = pct >= 75 ? 'var(--grn)' : pct >= 40 ? 'var(--gold)' : 'var(--hot)';
    return { ...d, col, pct, streak, done, barCol };
  });

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleSaveTarget() {
    const v = parseInt(targetVal);
    if (v >= 1 && v <= 30) { setTarget(v); showToast('target updated'); }
  }

  function handleExport() {
    const data = exportData();
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    a.download = 'maya-os-backup-' + today() + '.json';
    a.click();
    showToast('data exported');
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (importData(ev.target.result)) {
        showToast('data imported ✓');
      } else {
        showToast('import failed — invalid file');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function handleResetToday() { resetToday(); showToast('today reset'); }
  function handleClearAll() { clearAll(); }

  return (
    <div className={styles.settingsWrap}>

      {/* ── Progression ────────────────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Progression</div>
        <div className={styles.statGrid}>
          <div className={styles.statCell}><div className={styles.scVal}>{level}</div><div className={styles.scLbl}>Level</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{title}</div><div className={styles.scLbl}>Title</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{profile.streak || 0}</div><div className={styles.scLbl}>Perfect Streak</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{profile.longest || 0}</div><div className={styles.scLbl}>Longest Streak</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{profile.perfect || 0}</div><div className={styles.scLbl}>Perfect Days</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{pastDayKeys.length}</div><div className={styles.scLbl}>Days Tracked</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{frogsCompleted}</div><div className={styles.scLbl}>Frogs Done</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{avgPts}</div><div className={styles.scLbl}>Avg Pts / Day</div></div>
        </div>

        {/* XP Progress Bar */}
        <div className={styles.xpBarWrap}>
          <div className={styles.xpBarLabel}>
            <span>XP: {xpCurrent} / {xpToNext}</span>
            <span>{nextTitle ? `→ Lv ${level + 1}: ${nextTitle}` : '★ max level'}</span>
          </div>
          <div className={styles.xpBarTrack}>
            <div className={styles.xpBarFill} style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Workout ────────────────────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Workout</div>
        <div className={styles.statGrid}>
          <div className={styles.statCell}><div className={styles.scVal}>{totalWorkouts}</div><div className={styles.scLbl}>Total Workouts</div></div>
          <div className={styles.statCell}><div className={styles.scVal}>{workoutStreak}</div><div className={styles.scLbl}>Workout Streak</div></div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Activity Heatmap ───────────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Activity — Last 13 Weeks</div>
        <div className={styles.heatmapWrap}>
          <div className={styles.heatDayLabels}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className={styles.heatDayLbl}>{d}</div>
            ))}
          </div>
          <div className={styles.heatGrid}>
            {heatGrid.map((week, wi) => (
              <div key={wi} className={styles.heatCol}>
                {week.map((date, di) => {
                  const clr = getHeatColor(date);
                  return (
                    <div
                      key={di}
                      className={`${styles.heatCell}${clr === 'future' ? ` ${styles.heatCellFuture}` : ''}`}
                      style={clr && clr !== 'future' ? { background: clr, boxShadow: `0 0 3px ${clr}55` } : {}}
                      title={date}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.heatLegend}>
          {TIER_LEGEND.map(([label, clr]) => (
            <span key={label} className={styles.heatLegendItem}>
              <span className={styles.heatLegendDot} style={{ background: clr }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── 30-day Points Chart ────────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Points — Last 30 Days</div>
        <div className={styles.barChartWrap}>
          <div className={styles.barChartNote}>
            <span>{barStart}</span>
            <span>target: {currentTarget}pts</span>
            <span>{todayStr}</span>
          </div>
          <div className={styles.barChart}>
            <div className={styles.barTargetLine} />
            {barData.map(({ date, pct, tier }) => (
              <div
                key={date}
                className={styles.bar}
                style={tier ? {
                  height: `${pct}%`,
                  background: TIER_CLR[tier],
                  boxShadow: `0 0 3px ${TIER_CLR[tier]}55`,
                } : {
                  height: '2px',
                  background: 'var(--s3)',
                  opacity: 0.4,
                }}
                title={tier ? `${date}: ${pct}% of target` : `${date}: no data`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Daily Consistency ──────────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Daily Consistency</div>
        {n > 0 ? (
          <>
            <div className={styles.statsNote}>Completion rate across {pastDayKeys.length} tracked day{pastDayKeys.length !== 1 ? 's' : ''}</div>
            {dailyStats.map(d => (
              <div key={d.id} className={styles.dailyStatRow}>
                <span className={styles.dsDot} style={{ background: d.col, boxShadow: `0 0 4px ${d.col}88` }} />
                <span className={styles.dsName}>{d.name}</span>
                <div className={styles.dsBarWrap}>
                  <div className={styles.dsBarFill} style={{ width: `${d.pct}%`, background: d.barCol }} />
                </div>
                <span className={styles.dsPct}>{d.pct}%</span>
                <span className={styles.dsCount} title="Times completed">{d.done}×</span>
                <span className={styles.dsStreak} title="Current streak">{d.streak > 0 ? `🔥${d.streak}` : ''}</span>
              </div>
            ))}
          </>
        ) : <div className={styles.empty}>no dailies yet</div>}
      </div>

      <div className={styles.divider} />

      {/* ── Settings ───────────────────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Settings</div>
        <div className={styles.flexRow}>
          <span className={styles.targetLabel}>Point target / day:</span>
          <input
            type="number"
            className={`${styles.mi} ${styles.targetInput}`}
            min="1"
            max="30"
            value={targetVal}
            onChange={e => setTargetVal(e.target.value)}
          />
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleSaveTarget}>Save</button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Danger Zone ────────────────────────────────────────── */}
      <div className={styles.dangerZone}>
        <div className={`${styles.sgTitle} ${styles.dangerTitle}`} style={{ marginBottom: 9 }}>Danger Zone</div>
        <div className={styles.flexRow} style={{ marginBottom: 8 }}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleExport}>Export Data</button>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => fileRef.current?.click()}>Import Data</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        <div className={styles.flexRow}>
          <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={handleResetToday}>Reset Today</button>
          <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={handleClearAll}>Clear All Data</button>
        </div>
      </div>

    </div>
  );
}
