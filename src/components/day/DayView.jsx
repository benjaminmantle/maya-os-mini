import { useState, useRef, useEffect } from 'react';
import styles from '../../styles/components/DayView.module.css';
import Sidebar from '../sidebar/Sidebar.jsx';
import TaskCard from '../task/TaskCard.jsx';
import TaskEditModal from '../task/TaskEditModal.jsx';
import AssignPopup from '../task/AssignPopup.jsx';
import ContextMenu from '../shared/ContextMenu.jsx';
import LevelUpOverlay from '../shared/LevelUpOverlay.jsx';
import ContribHeatmap from '../shared/ContribHeatmap.jsx';
import { useToast } from '../shared/Toast.jsx';
import { scoreDay } from '../../utils/scoring.js';
import { addDays, dayLabel, today, uid } from '../../utils/dates.js';
import { parseInput, applyEmDash, timeToMins } from '../../utils/parsing.js';
import { starRank, snapToStarZone, insertTopOfStarGroup, insertAtForStars, doMove, snapToZoneByRank } from '../../utils/taskPlacement.js';
import {
  getDayRecord, saveTask, updateTask, deleteTask, moveTask,
  sortTasksForView, closeDay, reopenDay,
  setFrogsComplete, deleteDaily, saveDaily, toggleWorkout, carryForwardTasks,
  toggleFastBroken, getFastingSettings, isFastWindowPassed, getState, getProjects,
} from '../../store/store.js';


export default function DayView({
  tasks, dailies, profile, target, days, frogsComplete,
  activeTaskId, focusedTaskId,
  onStartTask, onFocusTask,
  getTimerDisplay,
  initialDate,
  theme,
}) {
  const { settings } = getState();
  const [focusDate, setFocusDate] = useState(initialDate || today());
  const [inputVal, setInputVal] = useState('');
  const [coreHidden, setCoreHidden] = useState(false);
  const [doneHidden, setDoneHidden] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [editDaily, setEditDaily] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [taskCtx, setTaskCtx] = useState({ visible: false, x: 0, y: 0, task: null });
  const [dailyCtx, setDailyCtx] = useState({ visible: false, x: 0, y: 0, daily: null });
  const [assignPopup, setAssignPopup] = useState(null);
  const [sortPts, setSortPts] = useState('desc');
  const [sortDur, setSortDur] = useState('desc');
  const [sortGrp, setSortGrp] = useState('desc');
  const [sortProj, setSortProj] = useState('desc');
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
  // Ideas use task.done; all other tasks use the day record
  const isDone = t => t.priority === 'idea' ? (t.done ?? false) : dayRecord.cIds.includes(t.id);
  const spTask = spId ? tasks.find(x => x.id === spId && !isDone(x) && x.scheduledDate === focusDate) : null;
  const allForDay = tasks.filter(t => t.scheduledDate === focusDate);
  const frogsOn = settings.frogsEnabled ?? true;
  const frogs = frogsOn ? allForDay.filter(t => t.isFrog && !isDone(t) && t.id !== spId) : [];
  const active = allForDay.filter(t => (frogsOn ? !t.isFrog : true) && !isDone(t) && t.id !== spId);
  // Tasks grouped by star rating; stable sort preserves S.tasks order within rank
  const activeSorted = [...active].sort((a, b) => starRank(a) - starRank(b));
  const done = allForDay.filter(t => isDone(t));
  const q = inputVal.trim().toLowerCase();
  const displayFrogs = q ? frogs.filter(t => t.name.toLowerCase().includes(q)) : frogs;
  const displayActive = q ? activeSorted.filter(t => t.name.toLowerCase().includes(q)) : activeSorted;
  const displayDone = q ? done.filter(t => t.name.toLowerCase().includes(q)) : done;
  const frogsDone = !!frogsComplete[focusDate];
  const allFrogsForDay = allForDay.filter(t => t.isFrog);
  const allFrogsDoneAuto = allFrogsForDay.length > 0 && allFrogsForDay.every(t => isDone(t));

  // ── Fasting timer ──────────────────────────────────────────────────────
  const todayStr = today();
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (focusDate !== todayStr) return;
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [focusDate]);

  const { fastStart, fastEnd } = getFastingSettings();
  const startMins = timeToMins(fastStart);
  const endMins = timeToMins(fastEnd);
  const nowMins = (() => { const n = new Date(nowTick); return n.getHours() * 60 + n.getMinutes(); })();
  const isToday = focusDate === todayStr;

  const fastState = (() => {
    if (dayRecord.fastBroken) return 'broken';
    if (!isToday) return focusDate < todayStr ? 'done' : 'pre';
    if (nowMins < startMins) return 'pre';
    if (nowMins < endMins) return 'active';
    return 'done';
  })();

  const fastTimerText = (() => {
    if (fastState === 'broken') return 'Fast broken';
    if (fastState === 'done') return isToday ? 'Fast locked' : 'Fasted';
    const targetMins = fastState === 'pre' ? startMins : endMins;
    const diff = targetMins - nowMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (fastState === 'pre') return `Opens in ${h > 0 ? h + 'h ' : ''}${m}m`;
    return `Closes in ${h > 0 ? h + 'h ' : ''}${m}m`;
  })();

  const fastProgress = (() => {
    if (fastState !== 'active') return 0;
    const total = endMins - startMins;
    const elapsed = nowMins - startMins;
    return total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  })();

  function handleBreakFast() { toggleFastBroken(focusDate); }
  const pastPending = focusDate === todayStr
    ? tasks.filter(t =>
        t.scheduledDate &&
        t.scheduledDate < todayStr &&
        !(t.priority === 'idea' ? t.done : days[t.scheduledDate]?.cIds?.includes(t.id))
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
  const ideaDoneKey = allForDay.filter(t => t.priority === 'idea' && t.done).map(t => t.id).join(',');
  const cIdsKey = dayRecord.cIds.join(',') + '|' + ideaDoneKey;
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
    const p = parseInput(raw, getProjects());
    const newId = uid();
    saveTask({
      id: newId, name: p.name, pts: p.pts, timeEstimate: p.time || null,
      isFrog: p.isFrog, priority: null, mayaPts: p.stars ?? 1, scheduledDate: focusDate, createdAt: new Date().toISOString(),
      ...(p.project ? { project: p.project } : {}),
    });
    // Reposition to top of its priority group (active is pre-save state, excludes new task)
    if (!p.isFrog) doMove(newId, insertTopOfStarGroup(p.stars ?? 1, activeSorted), activeSorted);
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
      showToast(
        r.tier === 'perfect' ? '\u2746 perfect day' :
        (r.tier === 'p90' || r.tier === 'p80') ? 'strong day' :
        (r.tier === 'p70' || r.tier === 'p60') ? 'decent day' :
        'day closed'
      );
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
      if (draggedTask?.priority === 'idea') return;
      const directCard = e.target.closest('[data-taskid]');
      const targetCard = directCard || hoveredCard;
      const needsZoneChange = !draggedTask ||
        draggedTask.scheduledDate !== focusDate ||
        (zone === 'frogs' ? !draggedTask.isFrog : draggedTask.isFrog);

      if (targetCard && targetCard.dataset.taskid !== id) {
        const rect = targetCard.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        if (zone === 'day') {
            const draggedStars = draggedTask?.mayaPts ?? 1;
            const zoneList = activeSorted.filter(t => t.id !== id);
            const targetIdx = zoneList.findIndex(t => t.id === targetCard.dataset.taskid);
            if (targetIdx !== -1) {
              let insertAt = before ? targetIdx : targetIdx + 1;
              // Sandwiching: if between same star group, adopt those stars
              if (insertAt > 0 && insertAt < zoneList.length) {
                const prevStars = zoneList[insertAt - 1]?.mayaPts ?? 1;
                const nextStars = zoneList[insertAt]?.mayaPts ?? 1;
                if (prevStars === nextStars && prevStars !== draggedStars) {
                  const patch = { mayaPts: prevStars };
                  if (needsZoneChange) { patch.scheduledDate = focusDate; patch.isFrog = false; }
                  updateTask(id, patch);
                } else {
                  insertAt = snapToStarZone(insertAt, zoneList, draggedStars);
                  if (needsZoneChange) updateTask(id, { scheduledDate: focusDate, isFrog: false });
                }
              } else {
                insertAt = snapToStarZone(insertAt, zoneList, draggedStars);
                if (needsZoneChange) updateTask(id, { scheduledDate: focusDate, isFrog: false });
              }
              doMove(id, insertAt, zoneList);
            } else {
              if (needsZoneChange) updateTask(id, { scheduledDate: focusDate, isFrog: false });
              moveTask(id, targetCard.dataset.taskid, before);
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
    if (!draggedTask || draggedTask.priority === 'idea') return;
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
    const newRank = 6 - Math.min(Math.max(n, 1), 5);
    // Reposition within activeSorted to top of its new rank group
    if (activeSorted.some(t => t.id === taskId)) {
      const zone = activeSorted.filter(t => t.id !== taskId);
      const insertAt = snapToZoneByRank(0, zone, newRank);
      doMove(taskId, insertAt, zone);
    }
  }



  function handleBump(taskId, dir) {
    const idx = activeSorted.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const rank = starRank(activeSorted[idx]);
    let lo = 0, hi = activeSorted.length;
    for (let i = 0; i < activeSorted.length; i++) {
      const r = starRank(activeSorted[i]);
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

  function renderCard(t, showAssign = false, onBump = null, showBacklog = false) {
    return (
      <TaskCard
        key={t.id}
        task={t}
        dayRecord={dayRecord}
        isActive={t.id === activeTaskId}
        isFocused={t.id === focusedTaskId && t.id !== activeTaskId}
        timerDisplay={getTimerDisplay(t)}
        onContextMenu={e => handleTaskContextMenu(e, t)}
        onStarChange={handleStarChange}
        inlineBump
        showAssign={showAssign}
        onAssign={handleAssign}
        onDelete={t.priority === 'idea' ? (id) => updateTask(id, { scheduledDate: null }) : undefined}
        onMoveToBacklog={showBacklog ? (id) => updateTask(id, { scheduledDate: null }) : undefined}
        onBump={onBump}
      />
    );
  }

  // Derive correct star highlight color from the context-menu task's card color
  function ctxStarColor(task) {
    if (!task) return 'var(--tel)';
    if (task.priority === 'idea') return 'var(--pri-idea)';
    if (task.project) {
      const proj = (getState().settings.projects || []).find(p => p.name === task.project);
      if (proj?.color) return `var(--${proj.color})`;
    }
    return 'var(--tel)';
  }

  const starRowItem = taskCtx.task ? {
    render: () => {
      const starColor = ctxStarColor(taskCtx.task);
      return (
        <div style={{ display: 'flex', gap: 0 }}>
          {[1,2,3,4,5].map(n => (
            <span
              key={n}
              style={{ fontSize: 17, cursor: 'pointer', padding: '2px 3px', color: n <= (taskCtx.task.mayaPts ?? 1) ? starColor : 'var(--b2)', transition: 'color 120ms ease' }}
              onClick={() => handleStarChange(taskCtx.task.id, n)}
            >★</span>
          ))}
        </div>
      );
    },
  } : null;

  const projRowItem = taskCtx.task && taskCtx.task.priority !== 'idea' ? {
    render: (closeFn) => {
      const allProjs = getProjects();
      const curProj = taskCtx.task.project;
      return (
        <div style={{ padding: '2px 0' }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3, letterSpacing: '.5px' }}>Project</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <span
              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, cursor: 'pointer', background: !curProj ? 'var(--s3)' : 'var(--s2)', color: !curProj ? 'var(--text)' : 'var(--t3)', border: '1px solid var(--b1)' }}
              onClick={() => { updateTask(taskCtx.task.id, { project: null }); closeFn(); }}
            >None</span>
            {allProjs.map(p => (
              <span
                key={p.name}
                style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                  background: `color-mix(in srgb, var(--${p.color || 'slv'}) 72%, #000)`,
                  color: '#fff', fontWeight: 600, letterSpacing: '.3px',
                  outline: curProj && curProj.toLowerCase() === p.name.toLowerCase() ? '2px solid var(--gold)' : 'none',
                  outlineOffset: 1,
                }}
                onClick={() => { updateTask(taskCtx.task.id, { project: p.name }); closeFn(); }}
              >{p.name}</span>
            ))}
          </div>
        </div>
      );
    },
    noClose: true,
  } : null;

  const taskCtxItems = taskCtx.task ? (
    taskCtx.task.priority === 'idea' ? [
      starRowItem,
      { separator: true },
      { label: '🗓️ Remove from day', danger: true, action: () => updateTask(taskCtx.task.id, { scheduledDate: null }) },
    ] : [
      { label: taskCtx.task.id === activeTaskId ? '⏹️ Stop' : '▶️ Start', start: true, action: () => onStartTask(taskCtx.task.id) },
      { label: taskCtx.task.id === focusedTaskId ? '☁️ Unfocus' : '⚡ Focus', action: () => onFocusTask(taskCtx.task.id) },
      { label: taskCtx.task.isFrog ? '🐸 Unfrog' : '🐸 Frog', active: taskCtx.task.isFrog, action: () => updateTask(taskCtx.task.id, { isFrog: !taskCtx.task.isFrog }) },
      { label: '✏️ Edit', action: () => setEditTask(taskCtx.task) },
      { separator: true },
      projRowItem,
      { separator: true },
      starRowItem,
      { separator: true },
      { label: '🗑️ Delete', danger: true, action: () => deleteTask(taskCtx.task.id) },
    ]
  ) : [];

  const dailyCtxItems = dailyCtx.daily ? [
    { label: '\u270e Edit', action: () => openDailyEdit(dailyCtx.daily) },
    { label: '\u2715 Delete', danger: true, action: () => deleteDaily(dailyCtx.daily.id) },
  ] : [];

  const iStyle = { background:'var(--s2)', border:'1px solid var(--b2)', borderRadius:'var(--rs)', padding:'8px 11px', fontSize:13, color:'var(--text)', width:'100%', outline:'none', fontFamily:'var(--f)', fontWeight:500 };
  const lStyle = { fontSize:9, color:'var(--t3)', letterSpacing:2, textTransform:'uppercase', fontFamily:'var(--fd)' };
  const btnBase = { padding:'5px 10px', borderRadius:'var(--rs)', fontSize:9, fontWeight:700, fontFamily:'var(--fd)', letterSpacing:2, textTransform:'uppercase', cursor:'pointer' };

  return (
    <div className={styles.focusLayout}>
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

        {/* Contributions heatmap */}
        <div className={styles.contribStrip}>
          <ContribHeatmap weeks={20} cellSize={10} gap={2} showDayLabels showMonthLabels showLegend />
        </div>

        {/* Fasting widget */}
        {settings.fastingEnabled && (
        <div className={styles.fastingStrip}>
          <span className={styles.fastIcon}>🍽</span>
          <span className={`${styles.fastLabel} ${
            fastState === 'pre' ? styles.fastLabelPre :
            fastState === 'active' ? styles.fastLabelActive :
            fastState === 'broken' ? styles.fastLabelBroken :
            styles.fastLabelDone
          }`}>
            {fastTimerText}
            {fastState === 'done' && <span className={styles.fastCheck}> ✓</span>}
            {fastState === 'broken' && <span className={styles.fastBroken}> ✗</span>}
          </span>
          {fastState === 'active' && (
            <div className={styles.fastProgress}>
              <div className={styles.fastProgressFill} style={{ width: fastProgress + '%' }} />
            </div>
          )}
          {(fastState === 'active' || fastState === 'done') && !dayRecord.fastBroken && focusDate === todayStr && (
            <button className={styles.fastBreakBtn} onClick={handleBreakFast} title="Mark fast as broken">✗</button>
          )}
        </div>
        )}

        {/* Frogs */}
        {frogsOn && (
        <div className={allFrogsDoneAuto ? styles.frogSecAllDone : (frogsDone ? styles.frogSecDone : styles.frogSec)} onContextMenu={handleFrogContextMenu}>
          <div className={styles.secLbl + ' ' + styles.secLblFrog} style={{ marginBottom:7, cursor:'pointer' }} onClick={handleFrogContextMenu}>
            {'\uD83D\uDC38'}&nbsp;Frogs{(frogsDone || allFrogsDoneAuto) && <span className={styles.frogCheck}>{' \u2713'}</span>}
          </div>
          <div className={styles.taskList + ' ' + styles.dropZone} onDragOver={makeDragOver(true)} onDragLeave={handleDragLeave} onDrop={makeDrop('frogs')}>
            {displayFrogs.map(t => renderCard(t))}
          </div>
        </div>
        )}

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
                  <button className={styles.sortBtn} title="Sort by points" onClick={() => { sortTasksForView(focusDate, 'pts', sortPts); setSortPts(sortPts === 'desc' ? 'asc' : 'desc'); }}>{sortPts === 'desc' ? 'P↓' : 'P↑'}</button>
                  <button className={styles.sortBtn} title="Sort by duration" onClick={() => { sortTasksForView(focusDate, 'dur', sortDur); setSortDur(sortDur === 'desc' ? 'asc' : 'desc'); }}>{sortDur === 'desc' ? 'T↓' : 'T↑'}</button>
                  <button className={styles.sortBtn} title="Sort by star group" onClick={() => { sortTasksForView(focusDate, 'mgrp', sortGrp); setSortGrp(sortGrp === 'desc' ? 'asc' : 'desc'); }}>{sortGrp === 'desc' ? 'G↓' : 'G↑'}</button>
                  <button className={styles.sortBtn} title="Sort by project" onClick={() => { sortTasksForView(focusDate, 'proj', sortProj); setSortProj(sortProj === 'desc' ? 'asc' : 'desc'); }}>{sortProj === 'desc' ? 'J↓' : 'J↑'}</button>
                </div>
              </div>
              <div className={styles.qaRow} style={{ marginBottom:7 }}>
                <input className={styles.qaInput} value={inputVal} onChange={e => setInputVal(applyEmDash(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
                <button className={styles.qaBtn} onClick={handleAdd}>+</button>
              </div>
              <div className={styles.taskList + ' ' + styles.dropZone} onDragOver={makeDragOver(false)} onDragLeave={handleDragLeave} onDrop={makeDrop('day')}>
                {activeSorted.length ? displayActive.map(t => renderCard(t, true, handleBump, true)) : <div className={styles.empty}>add a task above or drag from backlog</div>}
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
        onFocusTask={onFocusTask} onStartTask={onStartTask}
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
            if (date === focusDate) {
              const t = tasks.find(x => x.id === tid);
              if (t) {
                const zone = activeSorted.filter(x => x.id !== tid);
                doMove(tid, snapToZoneByRank(0, zone, starRank(t)), zone);
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
