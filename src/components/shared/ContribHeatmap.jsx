import { useMemo } from 'react';
import styles from '../../styles/components/ContribHeatmap.module.css';
import { useStore } from '../../hooks/useStore.js';
import { scoreDay } from '../../utils/scoring.js';
import { today, addDays } from '../../utils/dates.js';

const GREEN = {
  perfect: '#006d32',
  good:    '#26a641',
  decent:  '#7bc96f',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ContribHeatmap({
  weeks = 16,
  cellSize = 8,
  gap = 2,
  showDayLabels = false,
  showMonthLabels = false,
  showLegend = false,
}) {
  const { days, tasks, dailies, target } = useStore();
  const todayStr = today();

  const { grid, monthMarkers } = useMemo(() => {
    const dow = new Date(todayStr + 'T12:00:00').getDay(); // 0=Sun
    const currentMonday = addDays(todayStr, dow === 0 ? -6 : 1 - dow);
    const start = addDays(currentMonday, -(weeks - 1) * 7);
    const fakeState = { days, tasks: tasks || [], dailies, target };

    const g = Array.from({ length: weeks }, (_, wi) =>
      Array.from({ length: 7 }, (_, di) => {
        const date = addDays(start, wi * 7 + di);
        if (date > todayStr) return { date, color: null, future: true };
        const { tier } = scoreDay(date, fakeState);
        return { date, color: GREEN[tier] || null, future: false };
      })
    );

    // Month markers: find first Monday of each month in the grid
    const markers = [];
    if (showMonthLabels) {
      for (let wi = 0; wi < weeks; wi++) {
        const mon = g[wi][0].date; // Monday of this week
        const m = new Date(mon + 'T12:00:00').getMonth();
        const d = new Date(mon + 'T12:00:00').getDate();
        if (d <= 7 || wi === 0) {
          markers.push({ week: wi, label: MONTH_NAMES[m] });
        }
      }
    }

    return { grid: g, monthMarkers: markers };
  }, [days, tasks, dailies, target, todayStr, weeks, showMonthLabels]);

  const colWidth = cellSize + gap;
  const dayLabelWidth = showDayLabels ? 16 : 0;

  return (
    <div className={styles.wrap}>
      {showMonthLabels && (
        <div className={styles.monthRow} style={{ paddingLeft: dayLabelWidth + (showDayLabels ? 3 : 0) }}>
          {monthMarkers.map((m, i) => {
            const nextWeek = i < monthMarkers.length - 1 ? monthMarkers[i + 1].week : weeks;
            const span = nextWeek - m.week;
            return (
              <div key={i} className={styles.monthLbl} style={{ width: span * colWidth }}>
                {m.label}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.body}>
        {showDayLabels && (
          <div className={styles.dayLabels} style={{ gap }}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className={styles.dayLbl} style={{ height: cellSize, width: dayLabelWidth }}>
                {d}
              </div>
            ))}
          </div>
        )}

        <div className={styles.grid} style={{ gap }}>
          {grid.map((week, wi) => (
            <div key={wi} className={styles.col} style={{ gap }}>
              {week.map((cell, di) => (
                <div
                  key={di}
                  className={`${styles.cell}${cell.future ? ' ' + styles.cellFuture : ''}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    ...(cell.color ? { background: cell.color } : {}),
                  }}
                  title={cell.date}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {showLegend && (
        <div className={styles.legend} style={{ paddingLeft: dayLabelWidth + (showDayLabels ? 3 : 0) }}>
          <span>Less</span>
          <div className={styles.legendCell} style={{ background: 'var(--s2)' }} />
          <div className={styles.legendCell} style={{ background: GREEN.decent }} />
          <div className={styles.legendCell} style={{ background: GREEN.good }} />
          <div className={styles.legendCell} style={{ background: GREEN.perfect }} />
          <span>Best</span>
        </div>
      )}
    </div>
  );
}
