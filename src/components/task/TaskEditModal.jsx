import { useState, useEffect } from 'react';
import Modal from '../shared/Modal.jsx';
import styles from '../../styles/components/Modals.module.css';
import { updateTask, deleteTask } from '../../store/store.js';
import { get7, dayLabel } from '../../utils/dates.js';
import { applyEmDash } from '../../utils/parsing.js';

const MAYA_PREFIX = 'MAYA — ';

export default function TaskEditModal({ task, onClose }) {
  const isMaya = task.priority === 'maya';
  const isAi = task.priority === 'ai';
  const isSpecial = isMaya || isAi;
  const rawName = isMaya && task.name.startsWith(MAYA_PREFIX)
    ? task.name.slice(MAYA_PREFIX.length)
    : task.name;

  const [name, setName] = useState(rawName);
  const [pts, setPts] = useState(task.pts || 2);
  const [mayaPts, setMayaPts] = useState(task.mayaPts ?? 1);
  const [time, setTime] = useState(task.timeEstimate || '');
  const [sched, setSched] = useState(task.scheduledDate || '');
  const [frog, setFrog] = useState(!!task.isFrog);

  useEffect(() => {
    const rn = task.priority === 'maya' && task.name.startsWith(MAYA_PREFIX)
      ? task.name.slice(MAYA_PREFIX.length)
      : task.name;
    setName(rn);
    setPts(task.pts || 2);
    setMayaPts(task.mayaPts ?? 1);
    setTime(task.timeEstimate || '');
    setSched(task.scheduledDate || '');
    setFrog(!!task.isFrog);
  }, [task]);

  function handleSave() {
    const trimmed = name.trim() || rawName;
    const finalName = isMaya ? MAYA_PREFIX + trimmed : trimmed;
    updateTask(task.id, {
      name: finalName,
      pts,
      timeEstimate: time.trim() || null,
      scheduledDate: sched || null,
      isFrog: frog,
      ...(isSpecial && { mayaPts }),
    });
    onClose();
  }

  function handleDelete() {
    deleteTask(task.id);
    onClose();
  }

  const schedOptions = [
    { label: 'Backlog', date: '' },
    ...get7().map(d => ({ label: dayLabel(d), date: d })),
  ];

  return (
    <Modal onClose={onClose}>
      <div className={styles.modalTitle}>{isMaya ? 'Edit Maya Task' : isAi ? 'Edit AI Task' : 'Edit Task'}</div>
      <div className={styles.mf}>
        <div className={styles.ml}>{isMaya ? `Name  (MAYA — will be prepended)` : 'Name'}</div>
        <input className={styles.mi} type="text" value={name} onChange={e => setName(applyEmDash(e.target.value))} />
      </div>
      {isSpecial && (
        <div className={styles.mf}>
          <div className={styles.ml}>{isAi ? 'AI Priority' : 'Maya Priority'}</div>
          <div className={styles.btnRow}>
            {[1, 2, 3].map(v => (
              <button
                key={v}
                className={`${styles.selBtn} ${mayaPts === v ? styles.selBtnOn : ''}`}
                onClick={() => setMayaPts(v)}
              >
                {'★'.repeat(v)}{'☆'.repeat(3 - v)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={styles.mf}>
        <div className={styles.ml}>Points</div>
        <div className={styles.btnRow}>
          {[1, 2, 3].map(v => (
            <button
              key={v}
              className={`${styles.selBtn} ${pts === v ? styles.selBtnOn : ''}`}
              onClick={() => setPts(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.mf}>
        <div className={styles.ml}>Time Estimate</div>
        <input className={styles.mi} type="text" placeholder="e.g. 45m  2h" value={time} onChange={e => setTime(e.target.value)} />
      </div>
      <div className={styles.mf}>
        <div className={styles.ml}>Scheduled Day</div>
        <div className={styles.schedWrap}>
          {schedOptions.map(o => (
            <button
              key={o.date}
              className={`${styles.schedBtn} ${sched === o.date ? styles.schedBtnOn : ''}`}
              onClick={() => setSched(o.date)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {!isMaya && (
        <div
          className={`${styles.frogToggle} ${frog ? styles.frogToggleOn : ''}`}
          onClick={() => setFrog(!frog)}
        >
          <span>🐸</span><span>Frog — tackle this first</span>
        </div>
      )}
      <div className={styles.modalFoot}>
        <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={handleDelete}>Delete</button>
        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={handleSave}>Save</button>
      </div>
    </Modal>
  );
}
