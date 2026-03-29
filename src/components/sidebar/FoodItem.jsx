import { useState } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import tStyles from '../../styles/components/TaskCard.module.css';
import { applyEmDash } from '../../utils/parsing.js';

export default function FoodItem({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editCal, setEditCal] = useState(item.cal);

  function handleSave() {
    const name = editName.trim() || item.name;
    const cal = Math.max(0, parseInt(editCal, 10) || 0);
    if (name !== item.name || cal !== item.cal) {
      onUpdate(item.id, { name, cal });
    }
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setEditName(item.name);
      setEditCal(item.cal);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className={styles.foodItem}>
        <input
          className={styles.foodNameInput}
          value={editName}
          onChange={e => setEditName(applyEmDash(e.target.value))}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <input
          className={styles.foodCalInput}
          type="number"
          min="0"
          value={editCal}
          onChange={e => setEditCal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
        <span className={styles.foodCalUnit}>cal</span>
      </div>
    );
  }

  return (
    <div className={styles.foodItem}>
      <span className={styles.foodName} onClick={() => { setEditing(true); setEditName(item.name); setEditCal(item.cal); }}>
        {item.name}
      </span>
      {item.cal > 0 && <span className={styles.foodCal}>{item.cal}</span>}
      <span className={styles.foodActions}>
        <button className={`${tStyles.iconBtn} ${tStyles.del}`} onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} title="Delete">✕</button>
      </span>
    </div>
  );
}
