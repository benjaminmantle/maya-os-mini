import { useState, useEffect } from 'react';
import Modal from '../shared/Modal.jsx';
import styles from '../../styles/components/Modals.module.css';
import { updateTask, deleteTask } from '../../store/store.js';
import { get7, dayLabel } from '../../utils/dates.js';

export default function TaskEditModal({ task, onClose }) {
  const [name, setName] = useState(task.name);
  const [pts, setPts] = useState(task.pts || 2);
  const [time, setTime] = useState(task.timeEstimate || '');
  const [sched, setSched] = useState(task.scheduledDate || '');
  const [frog, setFrog] = useState(!!task.isFrog);

  useEffect(() => {
    setName(task.name);
    setPts(task.pts || 2);
    setTime(task.timeEstimate || '');
    setSched(task.scheduledDate || '');
    setFrog(!!task.isFrog);
  }, [task]);

  function handleSave() {
    updateTask(task.id, {
      name: name.trim() || task.name,
      pts,
      timeEstimate: time.trim() || null,
      scheduledDate: sched || null,
      isFrog: frog,
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
      <div className={styles.modalTitle}>Edit Task</div>
      <div className={styles.mf}>
        <div className={styles.ml}>Name</div>
        <input className={styles.mi} type="text" value={name} onChange={e => setName(e.target.value)} />
      </div>
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
      <div
        className={`${styles.frogToggle} ${frog ? styles.frogToggleOn : ''}`}
        onClick={() => setFrog(!frog)}
      >
        <span>🐸</span><span>Frog — tackle this first</span>
      </div>
      <div className={styles.modalFoot}>
        <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={handleDelete}>Delete</button>
        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={handleSave}>Save</button>
      </div>
    </Modal>
  );
}
