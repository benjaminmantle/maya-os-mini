import { useState, useRef, useEffect } from 'react';
import styles from '../../styles/components/DayView.module.css';
import Sidebar from '../sidebar/Sidebar.jsx';
import TaskCard from '../task/TaskCard.jsx';
import TaskEditModal from '../task/TaskEditModal.jsx';
import AssignPopup from '../task/AssignPopup.jsx';
import ContextMenu from '../shared/ContextMenu.jsx';
import LevelUpOverlay from '../shared/LevelUpOverlay.jsx';
import { useToast } from '../shared/Toast.jsx';
import { scoreDay } from '../../utils/scoring.js';
import { addDays, dayLabel, today, uid } from '../../utils/dates.js';
import { parseInput, applyEmDash } from '../../utils/parsing.js';
import { priRank, snapToZone, insertAtForPri, insertTopOfGroup, doMove, taskRank, snapToZoneByRank } from '../../utils/taskPlacement.js';
import {
  getDayRecord, saveTask, updateTask, deleteTask, moveTask,
  sortTasksForView, closeDay, reopenDay,
  setFrogsComplete, deleteDaily, saveDaily, toggleWorkout, carryForwardTasks,
} from '../../store/store.js';

const PRI_ORDER = ['hi', 'md', 'lo'];
const PRI_COLORS = { hi: 'var(--hot)', md: 'var(--pri-md)', lo: 'var(--tel)' };
const PRI_LABELS = { hi: 'High', md: 'Med', lo: 'Low' };


export default function DayView({
  tasks, dailies, profile, target, days, frogsComplete,
  activeTaskId, focusedTaskId,
  onStartTask, onFocusTask,
  getTimerDisplay,
  initialDate,
  theme,
}) {
  const [focusDate, setFocusDate] = useState(initialDate || today());
  const [inputVal, setInputVal] = useState('');
  const [coreHidden, setCoreHidden] = useState(false);
  const [doneHidden, setDoneHidden] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [editDaily, setEditDaily] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [taskCtx, setTaskCtx] = useState({ visible: false, x: 0, y: 0, task: null });
  const [dailyCtx, setDailyCtx] = useState({ visible: false, x: 0, y: 0, daily: null });
  const [activePriColor, setActivePriColor] = useState(null);
  const [assignPopup, setAssignPopup] = useState(null);
  const [sortPts, setSortPts] = useState('desc');
  const [sortDur, setSortDur] = useState('desc');
  const [sortGrp, setSortGrp] = useState('desc');
  const [deEditName, setDeEditName] = useState('');
  const [deEditType, setDeEditType] = useState('general');
  const [spotlightDropActive, setSpotlightDropActive] = useState(false);
  const dragOverCardRef = useRef(null);
  const prevFrogStateRef = useRef({ date: null, done: false });
  const showToast = useToast();

  const dayRecord = getDayRecord(focusDate);
  const state = { tasks, dailies, days, profile, target };
  const sc = scoreDay(focusDate, state);
  const spId = activeTaskId || focusedTaskId;
  // Maya tasks use task.done; all others use the day record
  const isDone = t => t.priority === 'maya' ? (t.done ?? false) : dayRecord.cIds.includes(t.id);
  const spTask = spId ? tasks.find(x => x.id === spId && !isDone(x) && x.scheduledDate === focusDate) : null;
  const allForDay = tasks.filter(t => t.scheduledDate === focusDate);
  const frogs = allForDay.filter(t => t.isFrog && !isDone(t) && t.id !== spId);
  const active = allForDay.filter(t => !t.isFrog && !isDone(t) && t.id !== spId);
  // Maya tasks grouped by stars into hi/md/lo rank groups; stable sort preserves S.tasks order within rank
  const activeSorted = [...active].sort((a, b) => taskRank(a) - taskRank(b));
  const done = allForDay.filter(t => isDone(t));
  const q = inputVal.trim().toLowerCase();
  const displayFrogs = q ? frogs.filter(t => t.name.toLowerCase().includes(q)) : frogs;
  const displayActive = q ? activeSorted.filter(t => t.name.toLowerCase().includes(q)) : activeSorted;
  const displayDone = q ? done.filter(t => t.name.toLowerCase().includes(q)) : done;
  const frogsDone = !!frogsComplete[focusDate];
  const allFrogsForDay = allForDay.filter(t => t.isFrog);
  const allFrogsDoneAuto = allFrogsForDay.length > 0 && allFrogsForDay.every(t => isDone(t));

  const todayStr = today();
  const pastPending = focusDate === todayStr
    ? tasks.filter(t =>
        t.scheduledDate &&
        t.scheduledDate < todayStr &&
        !(t.priority === 'maya' ? t.done : days[t.scheduledDate]?.cIds?.includes(t.id))
      )
    : [];

  useEffect(() => {
    const prev = prevFrogStateRef.current;
    if (prev.date === focusDate && allFrogsDoneAuto && !prev.done) {
      showToast('🐸 all frogs eaten!');
    }
    prevFrogStateRef.current = { date: focusDate, done: allFrogsDoneAuto };
  }, [allFrogsDoneAuto, focusDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear focus/active state when the focused task is checked off
  const mayaDoneKey = allForDay.filter(t => t.priority === 'maya' && t.done).map(t => t.id).join(',');
  const cIdsKey = dayRecord.cIds.join(',') + '|' + mayaDoneKey;
  useEffect(() => {
    const spTaskObj = spId ? tasks.find(x => x.id === spId) : null;
    if (spTaskObj && isDone(spTaskObj)) {
      if (activeTaskId === spId) onStartTask(spId);
      else if (focusedTaskId === spId) onFocusTask(spId);
    }
  }, [cIdsKey, spId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdd() {
    const raw = inputVal.trim();
    if (!raw) return;
    const p = parseInput(raw);
    const newId = uid();
    saveTask({
      id: newId, name: p.name, pts: p.pts, timeEstimate: p.time || null,
      isFrog: p.isFrog, priority: p.priority || null, scheduledDate: focusDate, createdAt: new Date().toISOString(),
    });
    // Reposition to top of its priority group (active is pre-save state, excludes new task)
    if (!p.isFrog) doMove(newId, insertTopOfGroup(p.priority || null, activeSorted), activeSorted);
    setInputVal('');
  }

  function handleCloseDay() {
    if (dayRecord.closed) {
      reopenDay(focusDate);
      showToast('day reopened');
      return;
    }
    const r = closeDay(focusDate);
    if (r.leveled) {
      setLevelUp(r.profile.level);
    } else {
      showToast(r.tier === 'perfect' ? '\u2746 perfect day' : r.tier === 'good' ? 'good day' : 'day closed');
    }
  }

  function handleCarryForward() {
    const count = carryForwardTasks(todayStr);
    if (count > 0) showToast(`↺ ${count} brought forward`);
  }

  function handleFrogContextMenu(e) {
    e.preventDefault();
    setFrogsComplete(focusDate, !frogsDone);
  }

  function clearCardIndicator() {
    if (dragOverCardRef.current) {
      dragOverCardRef.current.style.borderTop = '';
      dragOverCardRef.current.style.borderBottom = '';
      dragOverCardRef.current = null;
    }
  }

  function makeDragOver(isFrog) {
    return (e) => {
      e.preventDefault();
      const zone = e.currentTarget;
      const card = e.target.closest('[data-taskid]');
      if (card) {
        if (dragOverCardRef.current !== card) { clearCardIndicator(); dragOverCardRef.current = card; }
        const rect = card.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        card.style.borderTop = before ? '2px solid rgba(240,176,48,.6)' : '';
        card.style.borderBottom = before ? '' : '2px solid rgba(240,176,48,.6)';
      } else {
        const cards = zone.querySelectorAll('[data-taskid]');
        if (cards.length === 0) {
          clearCardIndicator();
          zone.classList.add(isFrog ? styles.frogZoneActive : styles.dropZoneActive);
          return;
        }
        const firstCard = cards[0];
        const lastCard = cards[cards.length - 1];
        const firstRect = firstCard.getBoundingClientRect();
        if (e.clientY <= firstRect.top + firstRect.height / 2) {
          if (dragOverCardRef.current !== firstCard) { clearCardIndicator(); dragOverCardRef.current = firstCard; }
          firstCard.style.borderTop = '2px solid rgba(240,176,48,.6)';
          firstCard.style.borderBottom = '';
        } else {
          if (dragOverCardRef.current !== lastCard) { clearCardIndicator(); dragOverCardRef.current = lastCard; }
          lastCard.style.borderBottom = '2px solid rgba(240,176,48,.6)';
          lastCard.style.borderTop = '';
        }
      }
    };
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      clearCardIndicator();
      e.currentTarget.classList.remove(styles.dropZoneActive);
      e.currentTarget.classList.remove(styles.frogZoneActive);
    }
  }

  function makeDrop(zone) {
    return (e) => {
      e.preventDefault();
      const hoveredCard = dragOverCardRef.current;
      clearCardIndicator();
      e.currentTarget.classList.remove(styles.dropZoneActive);
      e.currentTarget.classList.remove(styles.frogZoneActive);
      const id = e.dataTransfer.getData('tid');
      if (!id) return;
      const draggedTask = tasks.find(t => t.id === id);
      const directCard = e.target.closest('[data-taskid]');
      const targetCard = directCard || hoveredCard;
      const needsZoneChange = !draggedTask ||
        draggedTask.scheduledDate !== focusDate ||
        (zone === 'frogs' ? !draggedTask.isFrog : draggedTask.isFrog);

      if (targetCard && targetCard.dataset.taskid !== id) {
        const rect = targetCard.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        if (zone === 'day') {
          const draggedPri = draggedTask?.priority ?? null;
          if (draggedPri === 'maya') {
            if (needsZoneChange) {
              // Initial assignment: schedule and position at top of effective rank group
              updateTask(id, { scheduledDate: focusDate, isFrog: false });
              const zoneList2 = activeSorted.filter(t => t.id !== id);
              doMove(id, snapToZoneByRank(0, zoneList2, taskRank(draggedTask)), zoneList2);
            } else {
              // Already on this day: allow repositioning within the effective rank group
              const zoneList = activeSorted.filter(t => t.id !== id);
              const targetIdx = zoneList.findIndex(t => t.id === targetCard.dataset.taskid);
              if (targetIdx !== -1) {
                let insertAt = before ? targetIdx : targetIdx + 1;
                insertAt = snapToZoneByRank(insertAt, zoneList, taskRank(draggedTask));
                doMove(id, insertAt, zoneList);
              }
            }
          } else {
            const zoneList = activeSorted.filter(t => t.id !== id);
            const targetIdx = zoneList.findIndex(t => t.id === targetCard.dataset.taskid);
            if (targetIdx !== -1) {
              let insertAt = before ? targetIdx : targetIdx + 1;
              const prevRank = insertAt > 0 ? taskRank(zoneList[insertAt - 1]) : undefined;
              const nextRank = insertAt < zoneList.length ? taskRank(zoneList[insertAt]) : undefined;
              const draggedRank = taskRank(draggedTask ?? { priority: draggedPri });
              // Recolor/decolor if sandwiched between two tasks of identical non-maya priority
              const prevPri = insertAt > 0 ? (zoneList[insertAt - 1]?.priority ?? null) : undefined;
              const nextPri = insertAt < zoneList.length ? (zoneList[insertAt]?.priority ?? null) : undefined;
              if (prevPri !== undefined && nextPri !== undefined && prevPri === nextPri && prevPri !== draggedPri && prevPri !== 'maya' && draggedPri !== 'maya') {
                const patch = { priority: prevPri };
                if (needsZoneChange) { patch.scheduledDate = focusDate; patch.isFrog = false; }
                updateTask(id, patch);
              } else {
                insertAt = snapToZoneByRank(insertAt, zoneList, draggedRank);
                if (needsZoneChange) updateTask(id, { scheduledDate: focusDate, isFrog: false });
              }
              doMove(id, insertAt, zoneList);
            } else {
              if (needsZoneChange) updateTask(id, { scheduledDate: focusDate, isFrog: false });
              moveTask(id, targetCard.dataset.taskid, before);
            }
          }
        } else {
          if (needsZoneChange) updateTask(id, { scheduledDate: focusDate, isFrog: zone === 'frogs' });
          moveTask(id, targetCard.dataset.taskid, before);
        }
      } else if (needsZoneChange) {
        updateTask(id, { scheduledDate: focusDate, isFrog: zone === 'frogs' });
        showToast('\u2192 ' + dayLabel(focusDate));
      }
      // If the dragged task was the spotlight task, unfocus/stop it
      if (id === activeTaskId) onStartTask(activeTaskId);
      else if (id === focusedTaskId) onFocusTask(focusedTaskId);
    };
  }

  function handleTaskContextMenu(e, task) {
    e.preventDefault();
    e.stopPropagation();
    setTaskCtx({ visible: true, x: e.clientX, y: e.clientY, task });
  }

  function handleDailyContextMenu(e, daily) {
    e.preventDefault();
    setDailyCtx({ visible: true, x: e.clientX, y: e.clientY, daily });
  }

  function openDailyEdit(daily) {
    setEditDaily(daily);
    setDeEditName(daily.name);
    setDeEditType(daily.type || 'general');
  }

  function handleDailySave() {
    if (!editDaily) return;
    saveDaily({ ...editDaily, name: deEditName.trim() || editDaily.name, type: deEditType });
    setEditDaily(null);
  }

  function handleAssign(taskId, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = tasks.find(x => x.id === taskId);
    setAssignPopup({ taskId, currentDate: t?.scheduledDate || null, x: rect.left, y: rect.bottom + 4 });
  }

  function handleSpotlightDragOver(e) {
    e.preventDefault();
    setSpotlightDropActive(true);
  }

  function handleSpotlightDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setSpotlightDropActive(false);
    }
  }

  function handleSpotlightDrop(e) {
    e.preventDefault();
    setSpotlightDropActive(false);
    const id = e.dataTransfer.getData('tid');
    if (!id || id === spId) return;
    const draggedTask = tasks.find(t => t.id === id);
    if (!draggedTask) return;
    // Un-frog the outgoing spotlight task so it returns to core tasks (not frogs)
    if (spTask?.isFrog) {
      updateTask(spTask.id, { isFrog: false });
    }
    // Schedule backlog task for today; un-frog incoming frog task (spotlight = core territory)
    if (!draggedTask.scheduledDate) {
      updateTask(id, { scheduledDate: focusDate, isFrog: false });
    } else if (draggedTask.isFrog) {
      updateTask(id, { isFrog: false });
    }
    onFocusTask(id);
  }

  function handleStarChange(taskId, n) {
    updateTask(taskId, { mayaPts: n });
    const newRank = n >= 3 ? 1 : n >= 2 ? 2 : 3;
    // Reposition within activeSorted to top of its new rank group
    if (activeSorted.some(t => t.id === taskId)) {
      const zone = activeSorted.filter(t => t.id !== taskId);
      const insertAt = snapToZoneByRank(0, zone, newRank);
      doMove(taskId, insertAt, zone);
    }
  }

  function handlePriorityChange(taskId, newPri) {
    updateTask(taskId, { priority: newPri });
    const inActive = activeSorted.some(t => t.id === taskId);
    if (inActive) {
      const zone = activeSorted.filter(t => t.id !== taskId);
      doMove(taskId, insertAtForPri(newPri, zone), zone);
    } else {
      // Backlog task (right-clicked from context menu)
      const t = tasks.find(x => x.id === taskId);
      if (t && !t.scheduledDate) {
        const backlogZone = tasks.filter(x => !x.scheduledDate && x.id !== taskId);
        doMove(taskId, insertAtForPri(newPri, backlogZone), backlogZone);
      }
    }
  }

  function handleBump(taskId, dir) {
    const idx = activeSorted.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const rank = taskRank(activeSorted[idx]);
    let lo = 0, hi = activeSorted.length;
    for (let i = 0; i < activeSorted.length; i++) {
      const r = taskRank(activeSorted[i]);
      if (r < rank) lo = i + 1;
      if (r > rank && hi === activeSorted.length) hi = i;
    }
    let targetPos;
    if (dir === 'up') targetPos = Math.max(lo, idx - 1);
    else if (dir === 'down') targetPos = Math.min(hi - 1, idx + 1);
    else if (dir === 'top') targetPos = lo;
    else targetPos = hi - 1;
    if (targetPos === idx) return;
    doMove(taskId, targetPos, activeSorted.filter(t => t.id !== taskId));
  }

  function renderCard(t, showAssign = false, onPriorityChange = null, onBump = null, showBacklog = false) {
    return (
      <TaskCard
        key={t.id}
        task={t}
        dayRecord={dayRecord}
        isActive={t.id === activeTaskId}
        isFocused={t.id === focusedTaskId && t.id !== activeTaskId}
        timerDisplay={getTimerDisplay(t)}
        onContextMenu={e => handleTaskContextMenu(e, t)}
        activePriColor={activePriColor}
        onPriorityChange={onPriorityChange}
        onStarChange={handleStarChange}
        inlineBump
        showAssign={showAssign}
        onAssign={handleAssign}
        onDelete={t.priority === 'maya' ? (id) => updateTask(id, { scheduledDate: null }) : undefined}
        onMoveToBacklog={showBacklog ? (id) => updateTask(id, { scheduledDate: null }) : undefined}
        onBump={onBump}
      />
    );
  }

  const taskCtxItems = taskCtx.task ? [
    { label: taskCtx.task.id === activeTaskId ? '\u23f9 Stop' : '\u25b6 Start', start: true, action: () => onStartTask(taskCtx.task.id) },
    { label: taskCtx.task.id === focusedTaskId ? '\u25c7 Unfocus' : '\u25c6 Focus', action: () => onFocusTask(taskCtx.task.id) },
    { label: '\u270e Edit', action: () => setEditTask(taskCtx.task) },
    ...taskCtx.task.priority !== 'maya' ? [
      { separator: true },
      { label: '\uD83D\uDD34 High priority', active: taskCtx.task.priority === 'hi', action: () => handlePriorityChange(taskCtx.task.id, taskCtx.task.priority === 'hi' ? null : 'hi') },
      { label: '\uD83D\uDFE1 Med priority',  active: taskCtx.task.priority === 'md', action: () => handlePriorityChange(taskCtx.task.id, taskCtx.task.priority === 'md' ? null : 'md') },
      { label: '\uD83D\uDD35 Low priority',  active: taskCtx.task.priority === 'lo', action: () => handlePriorityChange(taskCtx.task.id, taskCtx.task.priority === 'lo' ? null : 'lo') },
    ] : [],
    taskCtx.task.priority === 'maya'
      ? { label: '\uD83D\uDCC5 Remove from day', danger: true, action: () => updateTask(taskCtx.task.id, { scheduledDate: null }) }
      : { label: '\u2715 Delete', danger: true, action: () => deleteTask(taskCtx.task.id) },
  ] : [];

  const dailyCtxItems = dailyCtx.daily ? [
    { label: '\u270e Edit', action: () => openDailyEdit(dailyCtx.daily) },
    { label: '\u2715 Delete', danger: true, action: () => deleteDaily(dailyCtx.daily.id) },
  ] : [];

  const iStyle = { background:'var(--s2)', border:'1px solid var(--b2)', borderRadius:'var(--rs)', padding:'8px 11px', fontSize:13, color:'var(--text)', width:'100%', outline:'none', fontFamily:'var(--f)', fontWeight:500 };
  const lStyle = { fontSize:9, color:'var(--t3)', letterSpacing:2, textTransform:'uppercase', fontFamily:'var(--fd)' };
  const btnBase = { padding:'5px 10px', borderRadius:'var(--rs)', fontSize:9, fontWeight:700, fontFamily:'var(--fd)', letterSpacing:2, textTransform:'uppercase', cursor:'pointer' };

  return (
    <div className={styles.focusLayout} onClick={() => activePriColor && setActivePriColor(null)}>
      <div className={styles.focusMain} onClick={e => e.stopPropagation()}>

        {/* Date nav */}
        <div className={styles.dateRow}>
          <button className={styles.dateNav} onClick={() => setFocusDate(addDays(focusDate, -1))}>{'‹'}</button>
          <div className={styles.dateMain}>
            <div className={styles.dateBig}>{dayLabel(focusDate)}</div>
            <div className={styles.dateSub}>{new Date(focusDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</div>
          </div>
          <button className={styles.todayBtn} onClick={() => setFocusDate(today())}>Today</button>
          <button className={styles.dateNav} onClick={() => setFocusDate(addDays(focusDate, 1))}>{'›'}</button>
        </div>

        {/* Score block */}
        <div className={styles.scoreBlock}>
          <div className={styles.scoreRow}>
            <span className={styles.scoreKey}>Points</span>
            <div className={styles.barWrap}><div className={styles.barFill + ' ' + styles.barPts} style={{ width: Math.min(100, (sc.pts / sc.tgt) * 100) + '%' }} /></div>
            <span className={styles.scoreNum}>{sc.pts}/{sc.tgt}</span>
          </div>
          <div className={styles.scoreRow}>
            <span className={styles.scoreKey}>Dailies</span>
            <div className={styles.barWrap}><div className={styles.barFill + ' ' + styles.barDly} style={{ width: sc.dTot > 0 ? (sc.dDone / sc.dTot) * 100 + '%' : '100%' }} /></div>
            <span className={styles.scoreNum}>{sc.dDone}/{sc.dTot}</span>
          </div>
          <div className={styles.scoreFoot}>
            <div
              className={dayRecord.workout ? styles.workoutLabelDone : styles.workoutLabel}
              onClick={() => toggleWorkout(focusDate)}
            >🥊&nbsp;Workout{dayRecord.workout && <span className={styles.workoutCheck}> ✓</span>}</div>
            <div className={styles.scoreFootRight}>
              {pastPending.length > 0 && (
                <button className={styles.carryBtn} onClick={handleCarryForward} title="Bring past incomplete tasks to today">↺ {pastPending.length}</button>
              )}
              <button className={styles.closeBtn} onClick={handleCloseDay}>{dayRecord.closed ? 'Reopen Day' : 'Close Day'}</button>
            </div>
          </div>
        </div>

        {/* Frogs */}
        <div className={allFrogsDoneAuto ? styles.frogSecAllDone : (frogsDone ? styles.frogSecDone : styles.frogSec)} onContextMenu={handleFrogContextMenu}>
          <div className={styles.secLbl + ' ' + styles.secLblFrog} style={{ marginBottom:7, cursor:'pointer' }} onClick={handleFrogContextMenu}>
            {'\uD83D\uDC38'}&nbsp;Frogs{(frogsDone || allFrogsDoneAuto) && <span className={styles.frogCheck}>{' \u2713'}</span>}
          </div>
          <div className={styles.taskList + ' ' + styles.dropZone} onDragOver={makeDragOver(true)} onDragLeave={handleDragLeave} onDrop={makeDrop('frogs')}>
            {displayFrogs.map(t => renderCard(t))}
          </div>
        </div>

        {/* Spotlight — always rendered as a drop zone */}
        <div
          className={styles.spotlightDropZone + (spotlightDropActive ? ' ' + styles.spotlightDropActive : '')}
          onDragOver={handleSpotlightDragOver}
          onDragLeave={handleSpotlightDragLeave}
          onDrop={handleSpotlightDrop}
        >
          {spTask ? (
            <>
              <div className={styles.secLbl + ' ' + (spTask.id === activeTaskId ? styles.secLblActive : styles.secLblFocused)} style={{ marginBottom:7 }}>
                {spTask.id === activeTaskId ? '\u25b6 Running' : '\u25c6 Up Next'}
              </div>
              {renderCard(spTask)}
            </>
          ) : spotlightDropActive ? (
            <div className={styles.spotlightHint}>drop to focus</div>
          ) : null}
        </div>

        {/* Core tasks */}
        <div>
          <div className={styles.secRow}>
            <div className={styles.secLbl}>Core Tasks</div>
            <button className={styles.collapseBtn} onClick={() => setCoreHidden(!coreHidden)}>{coreHidden ? 'show' : 'hide'}</button>
          </div>
          {!coreHidden && (
            <>
              <div className={styles.toolbar}>
                <div className={styles.toolGroup}>
                  {PRI_ORDER.map(k => (
                    <button
                      key={k}
                      title={PRI_LABELS[k] + ' priority \u2014 click tasks to paint'}
                      style={{ '--pc': PRI_COLORS[k] }}
                      className={styles.priBtn + (activePriColor === k ? ' ' + styles.priBtnActive : '')}
                      onClick={() => setActivePriColor(activePriColor === k ? null : k)}
                    >
                      <span className={styles.priDot} />
                    </button>
                  ))}
                </div>
                <div className={styles.toolSep} />
                <div className={styles.toolGroup}>
                  <button className={styles.sortBtn} title="Sort by points" onClick={() => { sortTasksForView(focusDate, 'pts', sortPts); setSortPts(sortPts === 'desc' ? 'asc' : 'desc'); }}>{sortPts === 'desc' ? 'P↓' : 'P↑'}</button>
                  <button className={styles.sortBtn} title="Sort by duration" onClick={() => { sortTasksForView(focusDate, 'dur', sortDur); setSortDur(sortDur === 'desc' ? 'asc' : 'desc'); }}>{sortDur === 'desc' ? 'T↓' : 'T↑'}</button>
                  <button className={styles.sortBtn} title="Sort by priority group" onClick={() => { sortTasksForView(focusDate, 'grp', sortGrp); setSortGrp(sortGrp === 'desc' ? 'asc' : 'desc'); }}>{sortGrp === 'desc' ? 'G↓' : 'G↑'}</button>
                </div>
              </div>
              <div className={styles.qaRow} style={{ marginBottom:7 }}>
                <input className={styles.qaInput} value={inputVal} onChange={e => setInputVal(applyEmDash(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
                <button className={styles.qaBtn} onClick={handleAdd}>+</button>
              </div>
              <div className={styles.taskList + ' ' + styles.dropZone} onDragOver={makeDragOver(false)} onDragLeave={handleDragLeave} onDrop={makeDrop('day')}>
                {activeSorted.length ? displayActive.map(t => renderCard(t, true, handlePriorityChange, handleBump, true)) : <div className={styles.empty}>add a task above or drag from backlog</div>}
              </div>
            </>
          )}
        </div>

        {/* Done */}
        {done.length > 0 && (
          <div>
            <div className={styles.secRow}>
              <div className={styles.secLbl} style={{ color:'var(--t3)' }}>Done</div>
              <button className={styles.collapseBtn} onClick={() => setDoneHidden(!doneHidden)}>{doneHidden ? 'show' : 'hide'}</button>
            </div>
            {!doneHidden && (
              <div className={styles.taskList}>{displayDone.map(t => renderCard(t))}</div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar
        dailies={dailies} dayRecord={dayRecord} focusDate={focusDate}
        tasks={tasks} activeTaskId={activeTaskId} focusedTaskId={focusedTaskId}
        getTimerDisplay={getTimerDisplay} onEditDaily={openDailyEdit}
        onDailyContextMenu={handleDailyContextMenu} onTaskContextMenu={handleTaskContextMenu}
        theme={theme}
      />

      <ContextMenu visible={taskCtx.visible} x={taskCtx.x} y={taskCtx.y} items={taskCtxItems} onClose={() => setTaskCtx(m => ({ ...m, visible: false }))} />
      <ContextMenu visible={dailyCtx.visible} x={dailyCtx.x} y={dailyCtx.y} items={dailyCtxItems} onClose={() => setDailyCtx(m => ({ ...m, visible: false }))} />

      {editTask && <TaskEditModal task={editTask} onClose={() => setEditTask(null)} />}
      {assignPopup && (
        <AssignPopup
          taskId={assignPopup.taskId}
          currentDate={assignPopup.currentDate}
          x={assignPopup.x}
          y={assignPopup.y}
          onClose={() => setAssignPopup(null)}
          onScheduled={(tid, date) => {
            // For maya tasks scheduled onto today's view, reposition to top of rank group
            if (date === focusDate) {
              const t = tasks.find(x => x.id === tid);
              if (t?.priority === 'maya') {
                const zone = activeSorted.filter(x => x.id !== tid);
                doMove(tid, snapToZoneByRank(0, zone, taskRank(t)), zone);
              }
            }
          }}
        />
      )}

      {editDaily && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditDaily(null); }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(8px)', padding:18 }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'var(--r)', padding:20, width:'100%', maxWidth:390, display:'flex', flexDirection:'column', gap:13, boxShadow:'0 0 50px rgba(0,0,0,.9)' }}>
            <div style={{ fontSize:12, fontWeight:700, fontFamily:'var(--fd)', letterSpacing:3, textTransform:'uppercase', color:'var(--gold)' }}>Edit Daily</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <div style={lStyle}>Name</div>
              <input style={iStyle} type="text" value={deEditName} onChange={e => setDeEditName(applyEmDash(e.target.value))} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <div style={lStyle}>Type</div>
              <select style={{ ...iStyle, cursor:'pointer' }} value={deEditType} onChange={e => setDeEditType(e.target.value)}>
                <option value="general">General</option>
                <option value="exercise">Exercise</option>
                <option value="health">Health</option>
                <option value="focus">Focus</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'flex-end', paddingTop:11 }}>
              <button style={{ ...btnBase, background:'transparent', color:'var(--hot)', border:'1px solid rgba(255,48,96,.28)' }} onClick={() => { deleteDaily(editDaily.id); setEditDaily(null); }}>Delete</button>
              <button style={{ ...btnBase, background:'var(--s1)', color:'var(--t2)', border:'1px solid var(--b2)' }} onClick={() => setEditDaily(null)}>Cancel</button>
              <button style={{ ...btnBase, background:'var(--gold)', color:'#000', border:'none' }} onClick={handleDailySave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {levelUp && <LevelUpOverlay level={levelUp} onDismiss={() => setLevelUp(null)} />}
    </div>
  );
}
