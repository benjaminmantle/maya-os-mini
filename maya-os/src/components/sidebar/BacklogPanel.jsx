import { useState, useRef } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import dStyles from '../../styles/components/DayView.module.css';
import TaskCard from '../task/TaskCard.jsx';
import AssignPopup from '../task/AssignPopup.jsx';
import { saveTask, updateTask, moveTask, sortTasksForView } from '../../store/store.js';
import { uid } from '../../utils/dates.js';
import { parseInput } from '../../utils/parsing.js';

const PRI_ORDER = ['hi', 'md', 'lo'];
const PRI_COLORS = { hi: 'var(--hot)', md: 'var(--pri-md)', lo: 'var(--tel)' };
const PRI_LABELS = { hi: 'Hi', md: 'Med', lo: 'Lo' };

export default function BacklogPanel({
  tasks,
  activeTaskId,
  focusedTaskId,
  getTimerDisplay,
  onContextMenu,
  onDoubleClick,
  focusDate,
}) {
  const [inputVal, setInputVal] = useState('');
  const [assignPopup, setAssignPopup] = useState(null);
  const [activePriColor, setActivePriColor] = useState(null);
  const [sortPts, setSortPts] = useState('desc');
  const [sortDur, setSortDur] = useState('desc');
  const inputRef = useRef(null);
  const dragOverCardRef = useRef(null);

  const backlog = tasks.filter(t => !t.scheduledDate);

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
    const p = parseInput(raw);
    saveTask({
      id: uid(),
      name: p.name,
      pts: p.pts,
      timeEstimate: p.time || null,
      isFrog: p.isFrog,
      priority: p.priority || null,
      scheduledDate: null,
      createdAt: new Date().toISOString(),
    });
    setInputVal('');
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
      cardEl.style.borderTop = before ? '2px solid var(--gold)' : '';
      cardEl.style.borderBottom = before ? '' : '2px solid var(--gold)';
    } else {
      const cards = zone.querySelectorAll('[data-taskid]');
      if (cards.length === 0) { clearCardIndicator(); return; }
      const firstCard = cards[0];
      const lastCard = cards[cards.length - 1];
      const firstRect = firstCard.getBoundingClientRect();
      if (e.clientY <= firstRect.top + firstRect.height / 2) {
        if (dragOverCardRef.current !== firstCard) { clearCardIndicator(); dragOverCardRef.current = firstCard; }
        firstCard.style.borderTop = '2px solid var(--gold)';
        firstCard.style.borderBottom = '';
      } else {
        if (dragOverCardRef.current !== lastCard) { clearCardIndicator(); dragOverCardRef.current = lastCard; }
        lastCard.style.borderBottom = '2px solid var(--gold)';
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
    const hoveredCard = dragOverCardRef.current;
    clearCardIndicator();
    const directCard = e.target.closest('[data-taskid]');
    const targetCard = directCard || hoveredCard;
    const draggedTask = tasks.find(t => t.id === id);
    const needsZoneChange = draggedTask && !!draggedTask.scheduledDate;
    if (needsZoneChange) {
      updateTask(id, { scheduledDate: null, isFrog: false });
    }
    if (targetCard && targetCard.dataset.taskid !== id) {
      const rect = targetCard.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      // Snap to group boundary so same-priority groups stay contiguous
      const draggedPri = draggedTask?.priority ?? null;
      const zoneList = backlog.filter(t => t.id !== id);
      const targetIdx = zoneList.findIndex(t => t.id === targetCard.dataset.taskid);
      if (targetIdx !== -1) {
        let insertAt = before ? targetIdx : targetIdx + 1;
        if (insertAt > 0 && insertAt < zoneList.length) {
          const prevPri = zoneList[insertAt - 1]?.priority ?? null;
          const nextPri = zoneList[insertAt]?.priority ?? null;
          if (prevPri !== null && prevPri === nextPri && prevPri !== draggedPri) {
            let groupStart = insertAt - 1;
            while (groupStart > 0 && (zoneList[groupStart - 1]?.priority ?? null) === prevPri) groupStart--;
            let groupEnd = insertAt;
            while (groupEnd < zoneList.length - 1 && (zoneList[groupEnd + 1]?.priority ?? null) === prevPri) groupEnd++;
            insertAt = (insertAt - groupStart) <= (groupEnd + 1 - insertAt) ? groupStart : groupEnd + 1;
          }
        }
        if (insertAt < zoneList.length) {
          moveTask(id, zoneList[insertAt].id, true);
        } else if (zoneList.length > 0) {
          moveTask(id, zoneList[zoneList.length - 1].id, false);
        }
      } else {
        moveTask(id, targetCard.dataset.taskid, before);
      }
    }
  }

  function handlePriBtn(color) {
    setActivePriColor(prev => prev === color ? null : color);
  }

  return (
    <div
      className={`${styles.stabPanel} ${styles.stabPanelActive}`}
      onClick={() => activePriColor && setActivePriColor(null)}
    >
      <div className={styles.panelAdd} onClick={e => e.stopPropagation()}>
        <div className={styles.qaRow}>
          <input
            ref={inputRef}
            className={styles.qaInput}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className={styles.qaBtn} onClick={handleAdd}>+</button>
        </div>
        <div className={dStyles.toolbar} style={{ marginTop: '6px' }}>
          <div className={dStyles.toolGroup}>
            {PRI_ORDER.map(k => (
              <button
                key={k}
                className={`${dStyles.priBtn} ${activePriColor === k ? dStyles.priBtnActive : ''}`}
                style={{ '--pc': PRI_COLORS[k] }}
                title={PRI_LABELS[k]}
                onClick={e => { e.stopPropagation(); handlePriBtn(k); }}
              >
                <div className={dStyles.priDot} />
              </button>
            ))}
          </div>
          <div className={dStyles.toolSep} />
          <div className={dStyles.toolGroup}>
            <button className={dStyles.sortBtn} title="Sort by points" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'pts', sortPts); setSortPts(sortPts === 'desc' ? 'asc' : 'desc'); }}>{sortPts === 'desc' ? 'P↓' : 'P↑'}</button>
            <button className={dStyles.sortBtn} title="Sort by duration" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'dur', sortDur); setSortDur(sortDur === 'desc' ? 'asc' : 'desc'); }}>{sortDur === 'desc' ? 'T↓' : 'T↑'}</button>
          </div>
        </div>
      </div>
      <div
        className={`${styles.panelBody} ${dStyles.taskList} ${dStyles.dropZone}`}
        onClick={e => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {backlog.length ? backlog.map(t => (
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
            activePriColor={activePriColor}
          />
        )) : <div className={styles.empty}>empty</div>}
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
