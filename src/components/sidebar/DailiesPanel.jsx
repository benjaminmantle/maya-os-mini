import { useState, useCallback } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import DailyItem from './DailyItem.jsx';
import FoodItem from './FoodItem.jsx';
import { todColor } from '../../utils/colors.js';
import { uid } from '../../utils/dates.js';
import { applyEmDash, parseFoodInput, sumCalories } from '../../utils/parsing.js';
import {
  markDailyComplete, saveDailies, saveDaily, deleteDaily as storeDeleteDaily,
  addFoodItem, updateFoodItem, deleteFoodItem, toggleFoodDone, getCalorieTarget, getState,
} from '../../store/store.js';
import { useToast } from '../shared/Toast.jsx';

export default function DailiesPanel({ dailies, dayRecord, focusDate, onEditDaily, onContextMenu, theme }) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('general');
  const [dragSrcId, setDragSrcId] = useState(null);
  const [foodInput, setFoodInput] = useState('');
  const showToast = useToast();

  const n = dailies.length;

  function handleToggle(id) {
    const done = dayRecord.dIds.includes(id);
    markDailyComplete(id, focusDate, !done);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    saveDaily({ id: uid(), name: newName.trim(), type: newType });
    setNewName('');
    setShowForm(false);
    showToast('daily added');
  }

  function handleDragOver(targetId) {
    // visual feedback handled by CSS
  }

  function handleDrop(targetId) {
    if (!dragSrcId || dragSrcId === targetId) return;
    const fromIdx = dailies.findIndex(x => x.id === dragSrcId);
    const toIdx = dailies.findIndex(x => x.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...dailies];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    saveDailies(reordered);
  }

  // ── Food log ──────────────────────────────────────────────────
  const foodLog = dayRecord.foodLog || [];
  const foodDone = !!dayRecord.foodDone;
  const totalCal = sumCalories(foodLog);
  const calorieTarget = getCalorieTarget();

  function handleAddFood() {
    const parsed = parseFoodInput(foodInput);
    if (!parsed) return;
    addFoodItem(focusDate, parsed.name, parsed.cal);
    setFoodInput('');
  }

  function handleFoodDone() {
    toggleFoodDone(focusDate);
  }

  return (
    <div className={`${styles.stabPanel} ${styles.stabPanelActive}`}>
      <div className={styles.panelBody}>
        <div className={styles.dailyList}>
          {dailies.length ? dailies.map((d, i) => (
            <DailyItem
              key={d.id}
              daily={d}
              index={i}
              total={n}
              done={dayRecord.dIds.includes(d.id)}
              color={todColor(i, n, theme)}
              onToggle={() => handleToggle(d.id)}
              onEdit={() => onEditDaily(d)}
              onDelete={() => storeDeleteDaily(d.id)}
              onContextMenu={(e) => onContextMenu(e, d)}
              onDragStart={setDragSrcId}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={() => setDragSrcId(null)}
            />
          )) : <div className={styles.empty}>no dailies — configure in settings</div>}
        </div>
        <div style={{ marginTop: 6 }}>
          {!showForm ? (
            <button className={styles.addDailyBtn} onClick={() => setShowForm(true)}>+ add daily</button>
          ) : (
            <div className={styles.addDailyForm}>
              <input
                className={styles.qaInput}
                placeholder="Daily name"
                value={newName}
                onChange={e => setNewName(applyEmDash(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false); }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                <select className={styles.typeSel} style={{ flex: 1, padding: '6px 5px' }} value={newType} onChange={e => setNewType(e.target.value)}>
                  <option value="general">General</option>
                  <option value="exercise">Exercise</option>
                  <option value="health">Health</option>
                  <option value="focus">Focus</option>
                  <option value="admin">Admin</option>
                </select>
                <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={handleAdd}>Add</button>
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => { setShowForm(false); setNewName(''); }}>✕</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Food Log ──────────────────────────────────────── */}
        {getState().settings.caloriesEnabled && <>
        <div className={styles.foodDivider} />
        <div className={foodDone ? styles.foodSectionDone : styles.foodSection}>
          <div className={styles.foodHeader}>
            <span className={styles.foodTitle}>🍽 Food Log</span>
            <span
              className={foodDone ? styles.foodTotalDone : (totalCal > calorieTarget ? styles.foodTotalOver : styles.foodTotal)}
              onClick={handleFoodDone}
              title="Click to mark done eating"
            >
              {totalCal} / {calorieTarget} cal
              {foodDone && <span className={styles.foodCheck}> ✓</span>}
            </span>
          </div>

          {foodLog.map(item => (
            <FoodItem
              key={item.id}
              item={item}
              onUpdate={(id, patch) => updateFoodItem(focusDate, id, patch)}
              onDelete={(id) => deleteFoodItem(focusDate, id)}
            />
          ))}

          <div className={styles.qaRow}>
            <input
              className={styles.qaInput}
              placeholder="food item 300cal"
              value={foodInput}
              onChange={e => setFoodInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddFood(); }}
            />
            <button className={styles.qaBtn} onClick={handleAddFood}>+</button>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
}
