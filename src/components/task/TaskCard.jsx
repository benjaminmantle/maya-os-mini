import { useState } from 'react';
import styles from '../../styles/components/TaskCard.module.css';
import { DURATIONS, isOpenEnded } from '../../utils/duration.js';
import { updateTask, deleteTask, markTaskComplete, markSpecialDone, getIdeaTopics } from '../../store/store.js';
import { applyEmDash } from '../../utils/parsing.js';

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
  onMoveToBacklog,
  onBump,
  inlineBump,
  noDrag,
}) {
  const [hovered, setHovered] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(task.name);
  const pri = task.priority; // null | 'hi' | 'md' | 'lo' | 'maya' | 'ai' | 'idea'
  const isSpecial = pri === 'maya' || pri === 'ai' || pri === 'idea';
  // Special-priority tasks (maya, ai) use task.done as their single done flag
  const done = isSpecial
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
    pri === 'ai' && !isFocused && !isActive && !task.isFrog ? styles.priAi : '',
    pri === 'idea' && !isFocused && !isActive && !task.isFrog ? styles.priIdea : '',
    pri === 'hi' && !isFocused && !isActive && !task.isFrog ? styles.priHi : '',
    pri === 'md' && !isFocused && !isActive && !task.isFrog ? styles.priMd : '',
    pri === 'lo' && !isFocused && !isActive && !task.isFrog ? styles.priLo : '',
    activePriColor ? styles.colorToolMode : '',
  ].filter(Boolean).join(' ');

  function handleCardClick(e) {
    // Special-priority tasks are immune to the paint tool
    if (!activePriColor || isSpecial) return;
    e.stopPropagation();
    const next = task.priority === activePriColor ? null : activePriColor;
    if (onPriorityChange) onPriorityChange(task.id, next);
    else updateTask(task.id, { priority: next });
  }

  function handleCheck(e) {
    e.stopPropagation();
    if (isSpecial) { markSpecialDone(task.id, !done); return; }
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

  function handleNameClick(e) {
    if (done || activePriColor) return; // don't edit done tasks or in paint mode
    e.stopPropagation();
    const display = task.name;
    setNameVal(display);
    setEditingName(true);
  }

  function handleNameSave() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== task.name) {
      const finalName = trimmed;
      updateTask(task.id, { name: finalName });
    }
    setEditingName(false);
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
      draggable={!editingName && !noDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onContextMenu={onContextMenu}
      onClick={handleCardClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(dayRecord || isSpecial) && (
        <div
          className={`${styles.chk} ${done ? styles.chkOn : ''}`}
          onClick={handleCheck}
        />
      )}
      <div className={styles.taskBody}>
        {editingName ? (
          <input
            className={styles.nameInput}
            value={nameVal}
            onChange={e => setNameVal(applyEmDash(e.target.value))}
            onBlur={handleNameSave}
            onKeyDown={e => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') { setNameVal(task.name); setEditingName(false); }
            }}
            onClick={e => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span
            className={`${styles.taskName} ${done ? styles.doneName : ''} ${!done && !activePriColor ? styles.nameClickable : ''}`}
            onClick={handleNameClick}
          >
            {task.name}
          </span>
        )}
        {pri !== 'idea' && (
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
        )}
        {isSpecial && (
          <div className={styles.mayaRow}>
            <div className={styles.mayaStars}>
              {[1, 2, 3].map(n => (
                <span
                  key={n}
                  className={`${styles.mayaStar} ${n <= (task.mayaPts ?? 1) ? (pri === 'ai' ? styles.aiStarOn : pri === 'idea' ? styles.ideaStarOn : styles.mayaStarOn) : ''}`}
                  onClick={onStarChange ? (e) => { e.stopPropagation(); onStarChange(task.id, n); } : undefined}
                  style={onStarChange ? { cursor: 'pointer' } : {}}
                >★</span>
              ))}
            </div>
            {showDateChip && task.scheduledDate && (
              <span className={pri === 'ai' ? styles.aiDateChip : pri === 'idea' ? styles.ideaDateChip : styles.mayaDateChip}>{task.scheduledDate}</span>
            )}
            {task.topic && pri === 'idea' && (() => {
              const topicObj = getIdeaTopics().find(x => x.name?.toLowerCase() === task.topic.toLowerCase());
              const tc = topicObj?.color || 'slv';
              return <span className={styles.ideaTopicChip} style={{ color: `var(--${tc})`, background: `color-mix(in srgb, var(--${tc}) 10%, transparent)`, borderColor: `color-mix(in srgb, var(--${tc}) 22%, transparent)` }}>{task.topic}</span>;
            })()}
          </div>
        )}
      </div>
      {timerDisplay && (
        <div className={`${styles.timer} ${timerDisplay.className === 'timer over' ? styles.over : ''} ${timerDisplay.className === 'timer open' ? styles.open : ''}`}>
          {timerDisplay.text}
        </div>
      )}
      <div className={styles.cardActions}>
        <div className={styles.cardActionsRow}>
          {onBump && inlineBump && (
            <div className={styles.bumpBtns}>
              <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'up'); }} title="Up one">↑</button>
              <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'top'); }} title="To top">⇈</button>
              <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'down'); }} title="Down one">↓</button>
              <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'bottom'); }} title="To bottom">⇊</button>
            </div>
          )}
          <button className={`${styles.iconBtn} ${styles.iconBtnEdit}`} onClick={(e) => { e.stopPropagation(); onContextMenu(e); }} title="Edit">✎</button>
          <button className={`${styles.iconBtn} ${styles.del}`} onClick={handleDelete} title="Delete">✕</button>
          {showAssign && (
            <button className={`${styles.iconBtn} ${styles.iconBtnAssign}`} onClick={(e) => { e.stopPropagation(); onAssign(task.id, e); }} title="Assign">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="1" y="2.5" width="11" height="9.5" rx="1.2" />
                <line x1="1" y1="5.5" x2="12" y2="5.5" />
                <line x1="4" y1="1" x2="4" y2="4" />
                <line x1="9" y1="1" x2="9" y2="4" />
              </svg>
            </button>
          )}
          {onMoveToBacklog && (
            <button className={`${styles.iconBtn} ${styles.iconBtnBack}`} onClick={(e) => { e.stopPropagation(); onMoveToBacklog(task.id); }} title="Move to backlog">↩</button>
          )}
        </div>
        {onBump && !inlineBump && hovered && (
          <div className={styles.bumpBtnsRow}>
            <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'up'); }} title="Up one">↑</button>
            <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'top'); }} title="To top">⇈</button>
            <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'down'); }} title="Down one">↓</button>
            <button className={styles.bumpBtn} onClick={e => { e.stopPropagation(); onBump(task.id, 'bottom'); }} title="To bottom">⇊</button>
          </div>
        )}
      </div>
    </div>
  );
}
