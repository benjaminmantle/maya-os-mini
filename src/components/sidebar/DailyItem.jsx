import { useState } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import tStyles from '../../styles/components/TaskCard.module.css';
import { saveDaily } from '../../store/store.js';
import { applyEmDash } from '../../utils/parsing.js';

export default function DailyItem({ daily, index, total, done, color, onToggle, onEdit, onDelete, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(daily.name);

  function handleNameClick(e) {
    if (done) return;
    e.stopPropagation();
    setNameVal(daily.name);
    setEditingName(true);
  }

  function handleNameSave() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== daily.name) {
      saveDaily({ ...daily, name: trimmed });
    }
    setEditingName(false);
  }

  return (
    <div
      className={`${styles.dailyItem} ${done ? styles.dailyItemDone : ''}`}
      draggable={!editingName}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(daily.id); e.target.style.opacity = '0.3'; }}
      onDragEnd={(e) => { e.target.style.opacity = ''; onDragEnd(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(daily.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(daily.id); }}
      onContextMenu={onContextMenu}
    >
      <span
        className={styles.dDotBtn}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title={done ? 'Mark incomplete' : 'Mark complete'}
      >
        <span
          className={styles.dDot}
          style={{ background: color, boxShadow: `0 0 5px ${color}88` }}
        />
      </span>
      {editingName ? (
        <input
          className={styles.dNameInput}
          value={nameVal}
          onChange={e => setNameVal(applyEmDash(e.target.value))}
          onBlur={handleNameSave}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') { setNameVal(daily.name); setEditingName(false); }
          }}
          onClick={e => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span
          className={`${styles.dName} ${done ? styles.dailyItemDoneName : ''} ${!done ? styles.dNameClickable : ''}`}
          onClick={handleNameClick}
        >
          {daily.name}
        </span>
      )}
      {done && <span className={styles.dChk}>✓</span>}
      <span className={styles.dActions}>
        <button className={tStyles.iconBtn} onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">✎</button>
        <button className={`${tStyles.iconBtn} ${tStyles.del}`} onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">✕</button>
      </span>
    </div>
  );
}
