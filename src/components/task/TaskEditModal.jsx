import { useState, useEffect } from 'react';
import Modal from '../shared/Modal.jsx';
import styles from '../../styles/components/Modals.module.css';
import { updateTask, deleteTask, getProjects } from '../../store/store.js';
import { get7, dayLabel } from '../../utils/dates.js';
import { applyEmDash } from '../../utils/parsing.js';

export default function TaskEditModal({ task, onClose }) {
  const isIdea = task.priority === 'idea';

  const [name, setName] = useState(task.name);
  const [pts, setPts] = useState(task.pts || 2);
  const [mayaPts, setMayaPts] = useState(task.mayaPts ?? 1);
  const [time, setTime] = useState(task.timeEstimate || '');
  const [sched, setSched] = useState(task.scheduledDate || '');
  const [frog, setFrog] = useState(!!task.isFrog);
  const [project, setProject] = useState(task.project || '');

  useEffect(() => {
    setName(task.name);
    setPts(task.pts || 2);
    setMayaPts(task.mayaPts ?? 1);
    setTime(task.timeEstimate || '');
    setSched(task.scheduledDate || '');
    setFrog(!!task.isFrog);
    setProject(task.project || '');
  }, [task]);

  function handleSave() {
    const trimmed = name.trim() || task.name;
    const patch = {
      name: trimmed,
      mayaPts,
    };
    if (!isIdea) {
      patch.pts = pts;
      patch.timeEstimate = time.trim() || null;
      patch.scheduledDate = sched || null;
      patch.isFrog = frog;
      patch.project = project || null;
    }
    updateTask(task.id, patch);
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

  const projects = getProjects();

  return (
    <Modal onClose={onClose}>
      <div className={styles.modalTitle}>{isIdea ? 'Edit Idea' : 'Edit Task'}</div>
      <div className={styles.mf}>
        <div className={styles.ml}>Name</div>
        <input className={styles.mi} type="text" value={name} onChange={e => setName(applyEmDash(e.target.value))} />
      </div>
      {/* Star rating — all task types */}
      <div className={styles.mf}>
        <div className={styles.ml}>Rating</div>
        <div style={{ display: 'flex', gap: 0 }}>
          {[1, 2, 3, 4, 5].map(v => (
            <span
              key={v}
              style={{ fontSize: 22, cursor: 'pointer', padding: '2px 4px', color: v <= mayaPts ? 'var(--tel)' : 'var(--b2)', transition: 'color 120ms ease' }}
              onClick={() => setMayaPts(v)}
            >★</span>
          ))}
        </div>
      </div>
      {/* Points — not for ideas */}
      {!isIdea && (
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
      )}
      {/* Time estimate — not for ideas */}
      {!isIdea && (
        <div className={styles.mf}>
          <div className={styles.ml}>Time Estimate</div>
          <input className={styles.mi} type="text" placeholder="e.g. 45m  2h" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      )}
      {/* Project — not for ideas */}
      {!isIdea && (
        <div className={styles.mf}>
          <div className={styles.ml}>Project</div>
          <select className={styles.mi} style={{ cursor: 'pointer' }} value={project} onChange={e => setProject(e.target.value)}>
            <option value="">None</option>
            {projects.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      {/* Scheduled day — not for ideas */}
      {!isIdea && (
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
      )}
      {/* Frog toggle — not for ideas */}
      {!isIdea && (
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
