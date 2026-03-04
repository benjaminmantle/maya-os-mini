import { useState } from 'react';
import styles from '../../styles/components/WeekView.module.css';
import { get7, today, shortDay, shortNum, dayLabel } from '../../utils/dates.js';
import { scoreDay } from '../../utils/scoring.js';
import { updateTask, getDayRecord } from '../../store/store.js';
import { useToast } from '../shared/Toast.jsx';

export default function WeekView({ tasks, dailies, days, profile, target, onGoToDay }) {
  const showToast = useToast();
  const state = { tasks, dailies, days, profile, target };
  const week = get7();

  function handleDrop(date) {
    return (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove(styles.dropTgt);
      const id = e.dataTransfer.getData('tid');
      if (id) {
        updateTask(id, { scheduledDate: date, isFrog: false });
        showToast(`→ ${dayLabel(date)}`);
      }
    };
  }

  return (
    <div className={styles.weekWrap}>
      <div className={styles.secLbl}>7-Day Overview</div>
      <div className={styles.weekGrid}>
        {week.map(d => {
          const sc = scoreDay(d, state);
          const dayRec = getDayRecord(d);
          const dayTasks = tasks.filter(t => t.scheduledDate === d);
          const pct = Math.min(100, (sc.pts / sc.tgt) * 100);
          const isToday = d === today();

          return (
            <div
              key={d}
              className={`${styles.dayCol} ${isToday ? styles.isToday : ''}`}
              onClick={() => onGoToDay(d)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add(styles.dropTgt); }}
              onDragLeave={e => e.currentTarget.classList.remove(styles.dropTgt)}
              onDrop={handleDrop(d)}
            >
              <div className={styles.dcWday}>{shortDay(d)}</div>
              <div className={`${styles.dcNum} ${isToday ? styles.dcNumToday : ''}`}>{shortNum(d)}</div>
              <div className={styles.dcBarRow}>
                <div className={styles.dcBar}>
                  <div className={styles.dcBarFill} style={{ width: `${pct}%` }} />
                </div>
                {sc.pts}/{sc.tgt}
              </div>
              {dayTasks.slice(0, 4).map(t => {
                const dn = dayRec.cIds.includes(t.id);
                return (
                  <div key={t.id} className={`${styles.dcTask} ${dn ? styles.dcTaskDone : ''} ${t.isFrog ? styles.dcTaskFrog : ''}`}>
                    {t.name}
                  </div>
                );
              })}
              {dayTasks.length > 4 && <div className={styles.dcMore}>+{dayTasks.length - 4}</div>}
              {dailies.length > 0 && (
                <div className={styles.dcDailies}>{sc.dDone}/{sc.dTot} dailies</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
