import { useState, useRef } from 'react';
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
import { parseInput } from '../../utils/parsing.js';
import {
  getDayRecord, saveTask, updateTask, deleteTask, moveTask,
  sortTasksForView, closeDay, reopenDay,
  setFrogsComplete, deleteDaily, saveDaily, toggleWorkout,
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
}) {
  const [focusDate, setFocusDate] = useState(initialDate || today());
  const [inputVal, setInputVal] = useState('');
  const [coreHidden, setCoreHidden] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [editDaily, setEditDaily] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [taskCtx, setTaskCtx] = useState({ visible: false, x: 0, y: 0, task: null });
  const [dailyCtx, setDailyCtx] = useState({ visible: false, x: 0, y: 0, daily: null });
  const [activePriColor, setActivePriColor] = useState(null);
  const [assignPopup, setAssignPopup] = useState(null);
  const [sortPts, setSortPts] = useState('desc');
  const [sortDur, setSortDur] = useState('desc');
  const [deEditName, setDeEditName] = useState('');
  const [deEditType, setDeEditType] = useState('general');
  const dragOverCardRef = useRef(null);
  const showToast = useToast();

  const dayRecord = getDayRecord(focusDate);
  const state = { tasks, dailies, days, profile, target };
  const sc = scoreDay(focusDate, state);
  const spId = activeTaskId || focusedTaskId;
  const spTask = spId ? tasks.find(x => x.id === spId && !dayRecord.cIds.includes(x.id)) : null;
  const allForDay = tasks.filter(t => t.scheduledDate === focusDate);
  const frogs = allForDay.filter(t => t.isFrog && !dayRecord.cIds.includes(t.id) && t.id !== spId);
  const active = allForDay.filter(t => !t.isFrog && !dayRecord.cIds.includes(t.id) && t.id !== spId);
  const done = allForDay.filter(t => dayRecord.cIds.includes(t.id));
  const frogsDone = !!frogsComplete[focusDate];

  function handleAdd() {
    const raw = inputVal.trim();
    if (!raw) return;
    const p = parseInput(raw);
    saveTask({
      id: uid(), name: p.name, pts: p.pts, timeEstimate: p.time || null,
      isFrog: p.isFrog, priority: p.priority || null, scheduledDate: focusDate, createdAt: new Date().toISOString(),
    });
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
      setLevelUp(profile.level);
    } else {
      showToast(r.tier === 'perfect' ? '\u2746 perfect day' : r.tier === 'good' ? 'good day' : 'day closed');
    }
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
      if (needsZoneChange) {
        updateTask(id, { scheduledDate: focusDate, isFrog: zone === 'frogs' });
      }
      if (targetCard && targetCard.dataset.taskid !== id) {
        const rect = targetCard.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        if (zone === 'day') {
          // Snap to group boundary so same-priority groups stay contiguous
          const draggedPri = draggedTask?.priority ?? null;
          const zoneList = active.filter(t => t.id !== id);
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
        } else {
          moveTask(id, targetCard.dataset.taskid, before);
        }
      } else if (needsZoneChange) {
        showToast('\u2192 ' + dayLabel(focusDate));
      }
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

  function renderCard(t, showAssign = false) {
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
        showAssign={showAssign}
        onAssign={handleAssign}
      />
    );
  }

  const taskCtxItems = taskCtx.task ? [
    { label: taskCtx.task.id === activeTaskId ? '\u23f9 Stop' : '\u25b6 Start', start: true, action: () => onStartTask(taskCtx.task.id) },
    { label: taskCtx.task.id === focusedTaskId ? '\u25c7 Unfocus' : '\u25c6 Focus', action: () => onFocusTask(taskCtx.task.id) },
    { label: '\u270e Edit', action: () => setEditTask(taskCtx.task) },
    { separator: true },
    { label: '\uD83D\uDD34 High priority', active: taskCtx.task.priority === 'hi', action: () => updateTask(taskCtx.task.id, { priority: taskCtx.task.priority === 'hi' ? null : 'hi' }) },
    { label: '\uD83D\uDFE1 Med priority',  active: taskCtx.task.priority === 'md', action: () => updateTask(taskCtx.task.id, { priority: taskCtx.task.priority === 'md' ? null : 'md' }) },
    { label: '\uD83D\uDD35 Low priority',  active: taskCtx.task.priority === 'lo', action: () => updateTask(taskCtx.task.id, { priority: taskCtx.task.priority === 'lo' ? null : 'lo' }) },
    { separator: true },
    { label: '\u2715 Delete', danger: true, action: () => deleteTask(taskCtx.task.id) },
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
            <button
              className={dayRecord.workout ? styles.workoutBtnOn : styles.workoutBtn}
              onClick={() => toggleWorkout(focusDate)}
            >Workout</button>
            <button className={styles.closeBtn} onClick={handleCloseDay}>{dayRecord.closed ? 'Reopen Day' : 'Close Day'}</button>
          </div>
        </div>

        {/* Frogs */}
        <div className={frogsDone ? styles.frogSecDone : styles.frogSec} onContextMenu={handleFrogContextMenu}>
          <div className={styles.secLbl + ' ' + styles.secLblFrog} style={{ marginBottom:7, cursor:'context-menu' }}>
            {'\uD83D\uDC38'}&nbsp;Frogs{frogsDone && <span className={styles.frogCheck}>{' \u2713'}</span>}
          </div>
          <div className={styles.taskList + ' ' + styles.dropZone} onDragOver={makeDragOver(true)} onDragLeave={handleDragLeave} onDrop={makeDrop('frogs')}>
            {frogs.map(t => renderCard(t))}
          </div>
        </div>

        {/* Spotlight */}
        {spTask && (
          <div>
            <div className={styles.secLbl + ' ' + (spTask.id === activeTaskId ? styles.secLblActive : styles.secLblFocused)} style={{ marginBottom:7 }}>
              {spTask.id === activeTaskId ? '\u25b6 Running' : '\u25c6 Up Next'}
            </div>
            {renderCard(spTask)}
          </div>
        )}

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
                </div>
              </div>
              <div className={styles.qaRow} style={{ marginBottom:7 }}>
                <input className={styles.qaInput} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
                <button className={styles.qaBtn} onClick={handleAdd}>+</button>
              </div>
              <div className={styles.taskList + ' ' + styles.dropZone} onDragOver={makeDragOver(false)} onDragLeave={handleDragLeave} onDrop={makeDrop('day')}>
                {active.length ? active.map(t => renderCard(t, true)) : <div className={styles.empty}>add a task above or drag from backlog</div>}
              </div>
            </>
          )}
        </div>

        {/* Done */}
        {done.length > 0 && (
          <div>
            <div className={styles.secLbl} style={{ color:'var(--t3)', marginBottom:7 }}>Done</div>
            <div className={styles.taskList}>{done.map(t => renderCard(t))}</div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar
        dailies={dailies} dayRecord={dayRecord} focusDate={focusDate}
        tasks={tasks} activeTaskId={activeTaskId} focusedTaskId={focusedTaskId}
        getTimerDisplay={getTimerDisplay} onEditDaily={openDailyEdit}
        onDailyContextMenu={handleDailyContextMenu} onTaskContextMenu={handleTaskContextMenu}
        onDoubleClick={onFocusTask} activePriColor={activePriColor}
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
        />
      )}

      {editDaily && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditDaily(null); }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(8px)', padding:18 }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'var(--r)', padding:20, width:'100%', maxWidth:390, display:'flex', flexDirection:'column', gap:13, boxShadow:'0 0 50px rgba(0,0,0,.9)' }}>
            <div style={{ fontSize:12, fontWeight:700, fontFamily:'var(--fd)', letterSpacing:3, textTransform:'uppercase', color:'var(--gold)' }}>Edit Daily</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <div style={lStyle}>Name</div>
              <input style={iStyle} type="text" value={deEditName} onChange={e => setDeEditName(e.target.value)} />
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
            <div style={{ display:'flex', gap:6, justifyContent:'flex-end', borderTop:'1px solid var(--b2)', paddingTop:11 }}>
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
