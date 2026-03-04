import { useEffect, useRef } from 'react';
import styles from '../../styles/components/Modals.module.css';
import { updateTask } from '../../store/store.js';
import { get7, dayLabel } from '../../utils/dates.js';
import { useToast } from '../shared/Toast.jsx';

export default function AssignPopup({ taskId, currentDate, x, y, onClose }) {
  const ref = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const options = [
    { label: 'Backlog', date: null },
    ...get7().map(d => ({ label: dayLabel(d), date: d })),
  ];

  function handleSelect(date) {
    updateTask(taskId, {
      scheduledDate: date,
      ...(date === null ? { isFrog: false } : {}),
    });
    showToast(date ? `→ ${dayLabel(date)}` : '→ backlog');
    onClose();
  }

  return (
    <div
      ref={ref}
      className={styles.assignPopup}
      style={{ top: y, left: Math.min(x, window.innerWidth - 170) }}
    >
      {options.map(o => (
        <button
          key={o.date || 'backlog'}
          className={`${styles.assignOpt} ${currentDate === o.date ? styles.assignOptCur : ''}`}
          onClick={() => handleSelect(o.date)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
