import { useState, useRef } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import mStyles from '../../styles/components/MayaPanel.module.css';
import dStyles from '../../styles/components/DayView.module.css';
import TaskCard from '../task/TaskCard.jsx';
import AssignPopup from '../task/AssignPopup.jsx';
import { saveTask, updateTask, moveTask } from '../../store/store.js';
import { uid } from '../../utils/dates.js';

const MAYA_PREFIX = 'MAYA \u2014 ';

export default function MayaPanel({
  tasks,
  activeTaskId,
  focusedTaskId,
  getTimerDisplay,
  onContextMenu,
}) {
  const [inputVal, setInputVal] = useState('');
  const [assignPopup, setAssignPopup] = useState(null);
  const inputRef = useRef(null);
  const dragOverCardRef = useRef(null);

  const mayaTasks = tasks.filter(t => t.priority === 'maya' && !t.done);

  function clearCardIndicator() {
    if (dragOverCardRef.current) {
      dragOverCardRef.current.style.borderTop = '';
      dragOverCardRef.current.style.borderBottom = '';
      dragOverCardRef.current = null;
    }
  }

  function handleAdd() {
    const raw = inputVal.trim();
    if (!raw) return;
    const name = raw.startsWith(MAYA_PREFIX) ? raw : MAYA_PREFIX + raw;
    const newId = uid();
    saveTask({
      id: newId,
      name,
      pts: 1,
      timeEstimate: null,
      isFrog: false,
      priority: 'maya',
      mayaPts: 1,
      scheduledDate: null,
      createdAt: new Date().toISOString(),
    });
    if (mayaTasks.length > 0) {
      moveTask(newId, mayaTasks[mayaTasks.length - 1].id, false);
    }
    setInputVal('');
  }

  function handleStarChange(taskId, n) {
    updateTask(taskId, { mayaPts: n });
  }

  function handleAssign(taskId, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = tasks.find(x => x.id === taskId);
    setAssignPopup({ taskId, currentDate: t?.scheduledDate || null, x: rect.left, y: rect.bottom + 4 });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add(dStyles.dropZoneActive);
    const zone = e.currentTarget;
    const cardEl = e.target.closest('[data-taskid]');
    if (cardEl) {
      if (cardEl !== dragOverCardRef.current) { clearCardIndicator(); dragOverCardRef.current = cardEl; }
      const rect = cardEl.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      cardEl.style.borderTop = before ? '2px solid var(--pri-maya)' : '';
      cardEl.style.borderBottom = before ? '' : '2px solid var(--pri-maya)';
    } else {
      const cards = zone.querySelectorAll('[data-taskid]');
      if (cards.length === 0) { clearCardIndicator(); return; }
      const firstCard = cards[0];
      const lastCard = cards[cards.length - 1];
      const firstRect = firstCard.getBoundingClientRect();
      if (e.clientY <= firstRect.top + firstRect.height / 2) {
        if (dragOverCardRef.current !== firstCard) { clearCardIndicator(); dragOverCardRef.current = firstCard; }
        firstCard.style.borderTop = '2px solid var(--pri-maya)';
        firstCard.style.borderBottom = '';
      } else {
        if (dragOverCardRef.current !== lastCard) { clearCardIndicator(); dragOverCardRef.current = lastCard; }
        lastCard.style.borderBottom = '2px solid var(--pri-maya)';
        lastCard.style.borderTop = '';
      }
    }
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove(dStyles.dropZoneActive);
      clearCardIndicator();
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove(dStyles.dropZoneActive);
    const id = e.dataTransfer.getData('tid');
    if (!id) { clearCardIndicator(); return; }
    const draggedTask = tasks.find(t => t.id === id);
    // Only accept maya tasks; reject all others silently
    if (!draggedTask || draggedTask.priority !== 'maya') {
      clearCardIndicator();
      return;
    }
    const hoveredCard = dragOverCardRef.current;
    clearCardIndicator();
    const directCard = e.target.closest('[data-taskid]');
    const targetCard = directCard || hoveredCard;
    if (targetCard && targetCard.dataset.taskid !== id) {
      const rect = targetCard.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      moveTask(id, targetCard.dataset.taskid, before);
    }
  }

  return (
    <div className={`${styles.stabPanel} ${styles.stabPanelActive}`}>
      <div className={styles.panelAdd}>
        <div className={styles.qaRow}>
          <input
            ref={inputRef}
            className={`${styles.qaInput} ${mStyles.mayaInput}`}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className={`${styles.qaBtn} ${mStyles.mayaBtn}`} onClick={handleAdd}>+</button>
        </div>
        <div className={mStyles.mayaHint}>MAYA — prepended automatically</div>
      </div>
      <div
        className={`${styles.panelBody} ${dStyles.taskList} ${dStyles.dropZone}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {mayaTasks.length ? mayaTasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            dayRecord={null}
            isActive={t.id === activeTaskId}
            isFocused={t.id === focusedTaskId && t.id !== activeTaskId}
            timerDisplay={getTimerDisplay(t)}
            onContextMenu={e => onContextMenu(e, t)}
            showAssign={true}
            onAssign={handleAssign}
            inSidebar={true}
            onStarChange={handleStarChange}
            showDateChip={true}
          />
        )) : <div className={styles.empty}>no maya tasks yet</div>}
      </div>
      {assignPopup && (
        <AssignPopup
          taskId={assignPopup.taskId}
          currentDate={assignPopup.currentDate}
          x={assignPopup.x}
          y={assignPopup.y}
          onClose={() => setAssignPopup(null)}
        />
      )}
    </div>
  );
}
