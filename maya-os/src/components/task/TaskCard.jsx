import styles from '../../styles/components/TaskCard.module.css';
import { DURATIONS, isOpenEnded } from '../../utils/duration.js';
import { updateTask, deleteTask, markTaskComplete, markMayaDone } from '../../store/store.js';

export default function TaskCard({
  task,
  dayRecord,
  isActive,
  isFocused,
  timerDisplay,
  onContextMenu,
  showAssign,
  onAssign,
  inSidebar,
  activePriColor,
  onPriorityChange,
  onStarChange,
  showDateChip,
  onDelete,
}) {
  const pri = task.priority; // null | 'hi' | 'md' | 'lo' | 'maya'
  // Maya tasks use task.done as their single done flag everywhere
  const done = pri === 'maya'
    ? (task.done ?? false)
    : (dayRecord && dayRecord.cIds.includes(task.id));
  const dur = task.timeEstimate || '';
  const open = isOpenEnded(dur) && dur !== '∞';
  const durLabel = dur || '—';
  const showPlus = dur && dur !== '∞';

  const cardClass = [
    styles.taskCard,
    task.isFrog ? styles.isFrog : '',
    done ? styles.done : '',
    isActive ? styles.activeTask : '',
    isFocused ? styles.focusedTask : '',
    inSidebar ? styles.sidebarCard : '',
    pri === 'maya' && !isFocused && !isActive && !task.isFrog ? styles.priMaya : '',
    pri === 'hi' && !isFocused && !isActive && !task.isFrog ? styles.priHi : '',
    pri === 'md' && !isFocused && !isActive && !task.isFrog ? styles.priMd : '',
    pri === 'lo' && !isFocused && !isActive && !task.isFrog ? styles.priLo : '',
    activePriColor ? styles.colorToolMode : '',
  ].filter(Boolean).join(' ');

  function handleCardClick(e) {
    // Maya tasks are immune to the paint tool
    if (!activePriColor || pri === 'maya') return;
    e.stopPropagation();
    const next = task.priority === activePriColor ? null : activePriColor;
    if (onPriorityChange) onPriorityChange(task.id, next);
    else updateTask(task.id, { priority: next });
  }

  function handleCheck(e) {
    e.stopPropagation();
    if (pri === 'maya') { markMayaDone(task.id, !done); return; }
    if (!task.scheduledDate) return;
    markTaskComplete(task.id, task.scheduledDate, !done);
  }

  const PTS_CYCLE = [1, 2, 3, 0, 0.5];
  function cyclePts(e) {
    e.stopPropagation();
    const cur = task.pts ?? 1;
    const idx = PTS_CYCLE.indexOf(cur);
    const next = PTS_CYCLE[(idx === -1 ? 0 : idx + 1) % PTS_CYCLE.length];
    updateTask(task.id, { pts: next });
  }

  function cycleTime(e) {
    e.stopPropagation();
    const clean = dur.replace(/\+$/, '');
    const wasOpen = isOpenEnded(dur) && dur !== '∞';
    const baseIdx = DURATIONS.indexOf(clean === '' ? null : clean);
    const next = DURATIONS[(baseIdx + 1) % DURATIONS.length];
    const newTime = next === null ? null : (wasOpen && next && next !== '∞' ? next + '+' : next);
    updateTask(task.id, { timeEstimate: newTime });
  }

  function toggleOpen(e) {
    e.stopPropagation();
    if (!dur || dur === '∞') return;
    updateTask(task.id, { timeEstimate: dur.endsWith('+') ? dur.slice(0, -1) : dur + '+' });
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (onDelete) onDelete(task.id);
    else deleteTask(task.id);
  }

  function handleDragStart(e) {
    e.dataTransfer.setData('tid', task.id);
    e.target.classList.add(styles.dragging);
  }

  function handleDragEnd(e) {
    e.target.classList.remove(styles.dragging);
  }

  return (
    <div
      className={cardClass}
      data-taskid={task.id}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onContextMenu={onContextMenu}
      onClick={handleCardClick}
    >
      {(dayRecord || pri === 'maya') && (
        <div
          className={`${styles.chk} ${done ? styles.chkOn : ''}`}
          onClick={handleCheck}
        />
      )}
      <div className={styles.taskBody}>
        <div className={`${styles.taskName} ${done ? styles.doneName : ''}`}>{task.name}</div>
        <div className={styles.taskMeta}>
          <span
            className={`${styles.badge} ${styles[task.pts === 0 ? 'p0' : task.pts === 0.5 ? 'p05' : `p${task.pts ?? 1}`]} ${styles.clickable}`}
            onClick={cyclePts}
          >
            {task.pts === 0.5 ? '0.5' : String(task.pts ?? 1)}
          </span>
          <span
            className={`${styles.badge} ${dur ? styles.bdurSet : styles.bdur}`}
            onClick={cycleTime}
            title="Click to change duration"
          >
            {durLabel}
          </span>
          {showPlus && (
            <span
              className={`${styles.badge} ${open ? styles.badgeOpen : styles.bdim}`}
              onClick={toggleOpen}
              title="Toggle open-ended"
            >
              +
            </span>
          )}
        </div>
        {pri === 'maya' && (
          <div className={styles.mayaRow}>
            <div className={styles.mayaStars}>
              {[1, 2, 3].map(n => (
                <span
                  key={n}
                  className={`${styles.mayaStar} ${n <= (task.mayaPts ?? 1) ? styles.mayaStarOn : ''}`}
                  onClick={onStarChange ? (e) => { e.stopPropagation(); onStarChange(task.id, n); } : undefined}
                  style={onStarChange ? { cursor: 'pointer' } : {}}
                >★</span>
              ))}
            </div>
            {showDateChip && task.scheduledDate && (
              <span className={styles.mayaDateChip}>{task.scheduledDate}</span>
            )}
          </div>
        )}
        {timerDisplay && (
          <div className={`${styles.timer} ${timerDisplay.className === 'timer over' ? styles.over : ''} ${timerDisplay.className === 'timer open' ? styles.open : ''}`}>
            {timerDisplay.text}
          </div>
        )}
      </div>
      {showAssign && (
        <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onAssign(task.id, e); }} title="Assign">📅</button>
      )}
      <button className={`${styles.iconBtn} ${styles.del}`} onClick={handleDelete} title="Delete">✕</button>
      <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onContextMenu(e); }} title="Edit">✎</button>
    </div>
  );
}
