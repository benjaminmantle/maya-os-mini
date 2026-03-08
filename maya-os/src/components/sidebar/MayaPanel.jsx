import { useState, useRef } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import mStyles from '../../styles/components/MayaPanel.module.css';
import dStyles from '../../styles/components/DayView.module.css';
import TaskCard from '../task/TaskCard.jsx';
import AssignPopup from '../task/AssignPopup.jsx';
import { saveTask, updateTask, moveTask, sortTasksForView } from '../../store/store.js';
import { uid } from '../../utils/dates.js';
import { parseInput } from '../../utils/parsing.js';

// Higher mayaPts = earlier in list. insertAt/snap based on this ordering.
function snapToStarZone(insertAt, zoneList, stars) {
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = zoneList[i].mayaPts ?? 1;
    if (r > stars) lo = i + 1;
    if (r < stars && hi === zoneList.length) hi = i;
  }
  return Math.min(Math.max(insertAt, lo), hi);
}

function insertAtForStars(stars, zoneList) {
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = zoneList[i].mayaPts ?? 1;
    if (r > stars) lo = i + 1;
    if (r < stars && hi === zoneList.length) hi = i;
  }
  // Insert at end of matching star group
  return lo + zoneList.slice(lo, hi).filter(t => (t.mayaPts ?? 1) === stars).length;
}

function insertTopOfStarGroup(stars, zoneList) {
  let lo = 0;
  for (let i = 0; i < zoneList.length; i++) {
    if ((zoneList[i].mayaPts ?? 1) > stars) lo = i + 1;
  }
  return lo;
}

function doMove(id, insertAt, zoneList) {
  if (insertAt < zoneList.length) moveTask(id, zoneList[insertAt].id, true);
  else if (zoneList.length > 0) moveTask(id, zoneList[zoneList.length - 1].id, false);
}

export default function MayaPanel({
  tasks,
  activeTaskId,
  focusedTaskId,
  getTimerDisplay,
  onContextMenu,
}) {
  const [inputVal, setInputVal] = useState('');
  const [assignPopup, setAssignPopup] = useState(null);
  const [sortPts, setSortPts] = useState('desc');
  const [sortDur, setSortDur] = useState('desc');
  const [sortGrp, setSortGrp] = useState('desc');
  const inputRef = useRef(null);
  const dragOverCardRef = useRef(null);

  // Store order IS the display order — handleAdd/handleStarChange maintain star-group order in store.
  // P/T sort buttons reorder store; star grouping is maintained by drag/star-change snap logic.
  const mayaTasks = tasks.filter(t => t.priority === 'maya' && !t.done);

  function clearCardIndicator() {
    if (dragOverCardRef.current) {
      dragOverCardRef.current.style.borderTop = '';
      dragOverCardRef.current.style.borderBottom = '';
      dragOverCardRef.current = null;
    }
  }

  const PRIORITY_TO_STARS = { hi: 3, md: 2, lo: 1 };

  function handleAdd() {
    const raw = inputVal.trim();
    if (!raw) return;
    const p = parseInput(raw);
    const stars = p.priority ? (PRIORITY_TO_STARS[p.priority] ?? 1) : 1;
    const newId = uid();
    saveTask({
      id: newId,
      name: p.name,
      pts: p.pts,
      timeEstimate: p.time || null,
      isFrog: false,
      priority: 'maya',
      mayaPts: stars,
      scheduledDate: null,
      createdAt: new Date().toISOString(),
    });
    doMove(newId, insertTopOfStarGroup(stars, mayaTasks), mayaTasks);
    setInputVal('');
  }

  function handleStarChange(taskId, n) {
    updateTask(taskId, { mayaPts: n });
    const zone = mayaTasks.filter(t => t.id !== taskId);
    doMove(taskId, insertAtForStars(n, zone), zone);
  }

  function handleBump(taskId, dir) {
    const idx = mayaTasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const stars = mayaTasks[idx].mayaPts ?? 1;
    let lo = 0, hi = mayaTasks.length;
    for (let i = 0; i < mayaTasks.length; i++) {
      const r = mayaTasks[i].mayaPts ?? 1;
      if (r > stars) lo = i + 1;
      if (r < stars && hi === mayaTasks.length) hi = i;
    }
    let targetPos;
    if (dir === 'up') targetPos = Math.max(lo, idx - 1);
    else if (dir === 'down') targetPos = Math.min(hi - 1, idx + 1);
    else if (dir === 'top') targetPos = lo;
    else targetPos = hi - 1;
    if (targetPos === idx) return;
    doMove(taskId, targetPos, mayaTasks.filter(t => t.id !== taskId));
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
      const firstCard = cards[0], lastCard = cards[cards.length - 1];
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
    if (!draggedTask || draggedTask.priority !== 'maya') { clearCardIndicator(); return; }
    const hoveredCard = dragOverCardRef.current;
    clearCardIndicator();
    const directCard = e.target.closest('[data-taskid]');
    const targetCard = directCard || hoveredCard;
    const draggedStars = draggedTask.mayaPts ?? 1;
    const zoneList = mayaTasks.filter(t => t.id !== id);
    setSortPts('desc'); setSortDur('desc'); setSortGrp('desc'); // reset sort state after manual drag
    if (targetCard && targetCard.dataset.taskid !== id) {
      const rect = targetCard.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      const targetIdx = zoneList.findIndex(t => t.id === targetCard.dataset.taskid);
      if (targetIdx !== -1) {
        let insertAt = before ? targetIdx : targetIdx + 1;
        if (insertAt > 0 && insertAt < zoneList.length) {
          const prevStars = zoneList[insertAt - 1]?.mayaPts ?? 1;
          const nextStars = zoneList[insertAt]?.mayaPts ?? 1;
          if (prevStars === nextStars && prevStars !== draggedStars) {
            // Sandwiched between same-star group — adopt that star rating
            updateTask(id, { mayaPts: prevStars });
            doMove(id, insertAt, zoneList);
          } else {
            insertAt = snapToStarZone(insertAt, zoneList, draggedStars);
            doMove(id, insertAt, zoneList);
          }
        } else {
          insertAt = snapToStarZone(insertAt, zoneList, draggedStars);
          doMove(id, insertAt, zoneList);
        }
      } else {
        moveTask(id, targetCard.dataset.taskid, before);
      }
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
        <div className={dStyles.toolbar} style={{ marginTop: '6px' }}>
          <div className={dStyles.toolGroup}>
            <button className={dStyles.sortBtn} title="Sort by points" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'pts', sortPts); setSortPts(sortPts === 'desc' ? 'asc' : 'desc'); }}>{sortPts === 'desc' ? 'P↓' : 'P↑'}</button>
            <button className={dStyles.sortBtn} title="Sort by duration" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'dur', sortDur); setSortDur(sortDur === 'desc' ? 'asc' : 'desc'); }}>{sortDur === 'desc' ? 'T↓' : 'T↑'}</button>
            <button className={dStyles.sortBtn} title="Sort by star group" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'mgrp', sortGrp); setSortGrp(sortGrp === 'desc' ? 'asc' : 'desc'); }}>{sortGrp === 'desc' ? 'G↓' : 'G↑'}</button>
          </div>
        </div>
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
            onBump={handleBump}
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
