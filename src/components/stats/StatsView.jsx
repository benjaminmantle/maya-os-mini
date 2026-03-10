import { useState, useRef } from 'react';
import styles from '../../styles/components/StatsView.module.css';
import { TITLES, scoreDay, expForLevel } from '../../utils/scoring.js';
import { todColor } from '../../utils/colors.js';
import { today, addDays } from '../../utils/dates.js';
import { setTarget, exportData, importData, exportTasks, importTasks, resetToday, clearAll } from '../../store/store.js';
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
  const taskFileRef = useRef(null);
  const showToast = useToast();

  const level = profile.level || 1;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
  const dayKeys = Object.keys(days).sort();
  const todayStr = today();
  const pastDayKeys = dayKeys.filter(dk => dk <= todayStr && (() => {
    const r = days[dk]; return r && (r.cIds?.length || r.dIds?.length || r.workout);
  })());
  const firstTrackedDay = pastDayKeys.length > 0 ? pastDayKeys[0] : todayStr;
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

  // ── Points bar chart (adaptive window, up to 30 days) ────────────────────
  const barWindowStart = firstTrackedDay > addDays(todayStr, -29) ? firstTrackedDay : addDays(todayStr, -29);
  const barDayCount = Math.round((new Date(todayStr + 'T12:00:00') - new Date(barWindowStart + 'T12:00:00')) / 86400000) + 1;
  const barData = Array.from({ length: barDayCount }, (_, i) => {
    const date = addDays(barWindowStart, i);
    const day = days[date];
    if (!day || (!day.cIds?.length && !day.dIds?.length)) return { date, pct: 0, tier: null };
    const { tier, pts } = scoreDay(date, fakeState);
    const pct = currentTarget > 0 ? Math.min(100, Math.round(pts / currentTarget * 100)) : 0;
    return { date, pct, tier };
  });

  // ── Radar chart (last 30 days) ───────────────────────────────────────────
  const days30 = Array.from({ length: 30 }, (_, i) => addDays(todayStr, -(29 - i)));
  const active30 = days30.filter(d => {
    const r = days[d]; return r && (r.cIds?.length || r.dIds?.length || r.workout);
  });
  const radarTasks = active30.length > 0
    ? active30.reduce((s, d) => s + Math.min(scoreDay(d, fakeState).pts, currentTarget) / Math.max(1, currentTarget), 0) / active30.length
    : 0;
  const dailyDays30 = active30.filter(d => scoreDay(d, fakeState).dTot > 0);
  const radarDailies = dailyDays30.length > 0
    ? dailyDays30.reduce((s, d) => { const { dDone, dTot } = scoreDay(d, fakeState); return s + dDone / dTot; }, 0) / dailyDays30.length
    : 0;
  const radarWorkout = days30.filter(d => days[d]?.workout).length / 30;
  const frogDays30 = days30.filter(d => (tasks || []).some(t => t.scheduledDate === d && t.isFrog));
  const radarFrogs = frogDays30.length > 0
    ? frogDays30.filter(d => {
        const frogs = (tasks || []).filter(t => t.scheduledDate === d && t.isFrog);
        const cIds = days[d]?.cIds || [];
        return frogs.every(t => cIds.includes(t.id));
      }).length / frogDays30.length
    : 0;
  const radarDiscipline = active30.length > 0
    ? active30.filter(d => days[d]?.closed).length / active30.length
    : 0;
  const radarValues = [radarTasks, radarDailies, radarWorkout, radarFrogs, radarDiscipline];

  const RADAR_AXES   = ['TASKS', 'DAILIES', 'WORKOUT', 'FROGS', 'DISCIPLINE'];
  const RADAR_COLORS = ['var(--gold)', 'var(--pur)', 'var(--hot)', 'var(--grn)', 'var(--tel)'];
  const RADAR_N = 5, RADAR_CX = 90, RADAR_CY = 90, RADAR_R = 68;

  function radarTip(i, scale = 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI / RADAR_N) * i;
    return [RADAR_CX + scale * RADAR_R * Math.cos(angle), RADAR_CY + scale * RADAR_R * Math.sin(angle)];
  }
  function ringPts(scale) {
    return Array.from({ length: RADAR_N }, (_, i) => radarTip(i, scale).join(',')).join(' ');
  }
  const userPts = radarValues.map((v, i) => radarTip(i, v).join(',')).join(' ');

  // ── Weekly rhythm ─────────────────────────────────────────────────────────
  const DOW_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const weeklyData = Array.from({ length: 7 }, (_, wi) => {
    const matching = pastDayKeys.filter(dk => {
      const d = new Date(dk + 'T12:00:00').getDay(); // 0=Sun
      return (d === 0 ? 6 : d - 1) === wi;
    });
    const active = matching.filter(d => { const r = days[d]; return r && (r.cIds?.length || r.dIds?.length || r.workout); });
    if (!active.length) return { wi, avgFrac: 0, count: 0 };
    const avg = active.reduce((s, d) => s + scoreDay(d, fakeState).frac, 0) / active.length;
    return { wi, avgFrac: avg, count: active.length };
  });

  function weekTierColor(frac) {
    if (frac >= 0.90) return TIER_CLR.perfect;
    if (frac >= 0.70) return TIER_CLR.good;
    if (frac >= 0.50) return TIER_CLR.decent;
    if (frac >= 0.35) return TIER_CLR.half;
    if (frac > 0.05)  return TIER_CLR.poor;
    return null;
  }

  // ── Trend chart (adaptive window, up to 60 days) ─────────────────────────
  const trendWindowStart = firstTrackedDay > addDays(todayStr, -59) ? firstTrackedDay : addDays(todayStr, -59);
  const trendDayCount = Math.round((new Date(todayStr + 'T12:00:00') - new Date(trendWindowStart + 'T12:00:00')) / 86400000) + 1;
  const trend60 = Array.from({ length: trendDayCount }, (_, i) => {
    const date = addDays(trendWindowStart, i);
    const day = days[date];
    const active = day && (day.cIds?.length || day.dIds?.length || day.workout);
    if (!active) return { date, tasks: null, dailies: null, overall: null, workout: false };
    const { pts, dDone, dTot, frac } = scoreDay(date, fakeState);
    return {
      date,
      tasks: currentTarget > 0 ? Math.min(pts / currentTarget, 1) : 0,
      dailies: dTot > 0 ? dDone / dTot : null,
      overall: frac,
      workout: !!day.workout,
    };
  });
  const TC_W = 380, TC_H = 110, TC_PL = 26, TC_PR = 8, TC_PT = 12, TC_PB = 18;
  const tc_cw = TC_W - TC_PL - TC_PR;
  const tc_ch = TC_H - TC_PT - TC_PB;
  const tcXn = Math.max(trendDayCount - 1, 1);
  function tcX(i) { return TC_PL + (i / tcXn) * tc_cw; }
  function tcY(v) { return TC_PT + (1 - v) * tc_ch; }
  function trendSegs(accessor) {
    const segs = []; let cur = [];
    trend60.forEach((d, i) => {
      const v = accessor(d);
      if (v !== null) { cur.push([i, v]); }
      else { if (cur.length) segs.push(cur); cur = []; }
    });
    if (cur.length) segs.push(cur);
    return segs;
  }

  // ── Per-daily stats ──────────────────────────────────────────────────────
  const dailyStats = dailies.map((d, i) => {
    const col = todColor(i, n);
    const total = pastDayKeys.length;
    const done = pastDayKeys.filter(dk => days[dk]?.dIds?.includes(d.id)).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    let streak = 0;
    for (const dk of [...pastDayKeys].reverse()) {
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

  function handleExportTasks() {
    const data = exportTasks();
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    a.download = 'maya-tasks-' + today() + '.json';
    a.click();
    showToast('tasks exported');
  }

  function handleImportTasks(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const count = importTasks(ev.target.result);
      if (count !== false) showToast(`${count} task${count !== 1 ? 's' : ''} imported`);
      else showToast('import failed — invalid file');
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
        <div className={styles.sgTitle}>Points — Last {barDayCount} Day{barDayCount !== 1 ? 's' : ''}</div>
        <div className={styles.barChartWrap}>
          <div className={styles.barChartNote}>
            <span>{barWindowStart}</span>
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
                } : {}}
                title={tier ? `${date}: ${pct}% of target` : `${date}: no data`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Balance — Last 30 Days ─────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Balance — Last 30 Days</div>
        <div className={styles.chartsRow}>

          {/* Radar chart */}
          <div className={styles.radarWrap}>
            <svg className={styles.radarSvg} viewBox="0 0 180 180">
              {/* User polygon */}
              <polygon className={styles.radarPoly} points={userPts} />
              {/* Colored dots at each axis value */}
              {radarValues.map((v, i) => {
                const [x, y] = radarTip(i, Math.max(v, 0.04));
                return <circle key={i} cx={x} cy={y} r={3} fill={RADAR_COLORS[i]} style={{ filter: `drop-shadow(0 0 3px ${RADAR_COLORS[i]})` }} />;
              })}
              {/* Axis tip labels */}
              {RADAR_AXES.map((label, i) => {
                const [lx, ly] = radarTip(i, 1.22);
                const ta = lx < RADAR_CX - 2 ? 'end' : lx > RADAR_CX + 2 ? 'start' : 'middle';
                const db = ly < RADAR_CY - 2 ? 'auto' : ly > RADAR_CY + 2 ? 'hanging' : 'middle';
                return (
                  <text key={i} className={styles.radarLabel} x={lx} y={ly} textAnchor={ta} dominantBaseline={db}>
                    {label}
                  </text>
                );
              })}
            </svg>
            <div className={styles.radarLegend}>
              {RADAR_AXES.map((label, i) => (
                <span key={i} className={styles.radarLegItem}>
                  <span className={styles.radarDot} style={{ background: RADAR_COLORS[i] }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Weekly rhythm */}
          <div className={styles.weekWrap}>
            <div className={styles.weekSubTitle}>Avg Score by Weekday</div>
            <div className={styles.weekRhythm}>
              {weeklyData.map(({ wi, avgFrac, count }) => {
                const clr = weekTierColor(avgFrac);
                return (
                  <div key={wi} className={styles.weekBarCol}>
                    <div
                      className={styles.weekBarTrack}
                      title={count
                        ? `${DOW_LABELS[wi]}: ${Math.round(avgFrac * 100)}% avg (${count} day${count !== 1 ? 's' : ''})`
                        : `${DOW_LABELS[wi]}: no data`}
                    >
                      {clr && (
                        <div
                          className={styles.weekBar}
                          style={{
                            height: `${Math.max(avgFrac * 100, 3)}%`,
                            background: clr,
                            boxShadow: `0 0 4px ${clr}66`,
                          }}
                        />
                      )}
                    </div>
                    <div className={styles.weekBarLbl}>{DOW_LABELS[wi]}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Trends — Last 60 Days ──────────────────────────────── */}
      <div className={styles.sg}>
        <div className={styles.sgTitle}>Trends — Last {trendDayCount} Day{trendDayCount !== 1 ? 's' : ''}</div>
        <svg className={styles.trendSvg} viewBox={`0 0 ${TC_W} ${TC_H}`}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <line key={v}
              x1={TC_PL} y1={tcY(v).toFixed(1)}
              x2={TC_W - TC_PR} y2={tcY(v).toFixed(1)}
              stroke="var(--b2)" strokeWidth="0.5"
            />
          ))}
          {/* Y-axis labels */}
          {[[0, '0%'], [0.5, '50%'], [1, '100%']].map(([v, lbl]) => (
            <text key={lbl} className={styles.trendAxisLbl}
              x={TC_PL - 3} y={tcY(v).toFixed(1)}
              textAnchor="end" dominantBaseline="middle">{lbl}</text>
          ))}
          {/* Overall score — gold */}
          {trendSegs(d => d.overall).map((seg, si) =>
            seg.length >= 2
              ? <polyline key={`ov${si}`} fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round"
                  points={seg.map(([i, v]) => `${tcX(i).toFixed(1)},${tcY(v).toFixed(1)}`).join(' ')} />
              : <circle key={`ov${si}`} cx={tcX(seg[0][0]).toFixed(1)} cy={tcY(seg[0][1]).toFixed(1)} r="2.5" fill="var(--gold)" />
          )}
          {/* Tasks score — orange */}
          {trendSegs(d => d.tasks).map((seg, si) =>
            seg.length >= 2
              ? <polyline key={`tk${si}`} fill="none" stroke="var(--ora)" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.8"
                  points={seg.map(([i, v]) => `${tcX(i).toFixed(1)},${tcY(v).toFixed(1)}`).join(' ')} />
              : <circle key={`tk${si}`} cx={tcX(seg[0][0]).toFixed(1)} cy={tcY(seg[0][1]).toFixed(1)} r="2" fill="var(--ora)" fillOpacity="0.8" />
          )}
          {/* Dailies rate — purple */}
          {trendSegs(d => d.dailies).map((seg, si) =>
            seg.length >= 2
              ? <polyline key={`dl${si}`} fill="none" stroke="var(--pur)" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.8"
                  points={seg.map(([i, v]) => `${tcX(i).toFixed(1)},${tcY(v).toFixed(1)}`).join(' ')} />
              : <circle key={`dl${si}`} cx={tcX(seg[0][0]).toFixed(1)} cy={tcY(seg[0][1]).toFixed(1)} r="2" fill="var(--pur)" fillOpacity="0.8" />
          )}
          {/* Workout day markers — teal dots above chart */}
          {trend60.map((d, i) => d.workout ? (
            <circle key={i} cx={tcX(i).toFixed(1)} cy={TC_PT - 3} r="2.5" fill="var(--tel)" fillOpacity="0.75" />
          ) : null)}
          {/* X-axis date labels */}
          <text className={styles.trendAxisLbl} x={TC_PL} y={TC_H - 3} textAnchor="start">{trendWindowStart}</text>
          <text className={styles.trendAxisLbl} x={TC_W - TC_PR} y={TC_H - 3} textAnchor="end">today</text>
        </svg>
        <div className={styles.trendLegend}>
          <span className={styles.trendLegItem}><span className={styles.trendLegLine} style={{ background: 'var(--gold)' }} />overall</span>
          <span className={styles.trendLegItem}><span className={styles.trendLegLine} style={{ background: 'var(--ora)', opacity: 0.8 }} />tasks</span>
          <span className={styles.trendLegItem}><span className={styles.trendLegLine} style={{ background: 'var(--pur)', opacity: 0.8 }} />dailies</span>
          <span className={styles.trendLegItem}><span className={styles.trendLegDot} style={{ background: 'var(--tel)', opacity: 0.75 }} />workout</span>
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
        <div className={styles.statsNote} style={{ marginBottom: 4 }}>Full backup</div>
        <div className={styles.flexRow} style={{ marginBottom: 12 }}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleExport}>Export Data</button>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => fileRef.current?.click()}>Import Data</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        <div className={styles.statsNote} style={{ marginBottom: 4 }}>Tasks only (unfinished)</div>
        <div className={styles.flexRow} style={{ marginBottom: 8 }}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleExportTasks}>Export Tasks</button>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => taskFileRef.current?.click()}>Import Tasks</button>
          <input ref={taskFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportTasks} />
        </div>
        <div className={styles.flexRow}>
          <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={handleResetToday}>Reset Today</button>
          <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={handleClearAll}>Clear All Data</button>
        </div>
      </div>

    </div>
  );
}
