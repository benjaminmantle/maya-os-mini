import { useState } from 'react';
import styles from '../../styles/components/TaskCard.module.css';
import { DURATIONS, isOpenEnded } from '../../utils/duration.js';
import { updateTask, deleteTask, markTaskComplete, markSpecialDone, getIdeaTopics, getProjects, editIdeaTopic, setIdeaTopicColor } from '../../store/store.js';
import { applyEmDash } from '../../utils/parsing.js';

// 8-column boustrophedon grid: row 1 →, row 2 ← (reversed in array for snake), row 3 →
const IDEA_PALETTE = [
  'red','hot','crl','pnk','lpnk','mgn','pri-maya','pur',     // row 1 →
  'lim','lgrn','grn','pri-idea','tel','blu','pri-ai','ind',  // row 2 ← (reversed so snake: pur→ind→…→lim→yel)
  'yel','gold','pri-md','ora','ora2','brn','gry','slv',      // row 3 →
];

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
  const [projPickerOpen, setProjPickerOpen] = useState(false);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [topicEditVal, setTopicEditVal] = useState('');
  const isIdea = task.priority === 'idea';
  // Ideas use task.done; all other tasks use dayRecord.cIds
  const done = isIdea
    ? (task.done ?? false)
    : (dayRecord && dayRecord.cIds.includes(task.id));
  const dur = task.timeEstimate || '';
  const open = isOpenEnded(dur) && dur !== '∞';
  const durLabel = dur || '—';
  const showPlus = dur && dur !== '∞';

  // Compute project color for card tinting
  const projObj = task.project ? (getProjects().find(p => p.name?.toLowerCase() === task.project.toLowerCase())) : null;
  const projColor = projObj?.color || null;

  const isProjCard = !isIdea && !!projColor && !isFocused && !isActive && !task.isFrog;

  const cardClass = [
    styles.taskCard,
    task.isFrog ? styles.isFrog : '',
    done ? styles.done : '',
    isActive ? styles.activeTask : '',
    isFocused ? styles.focusedTask : '',
    inSidebar ? styles.sidebarCard : '',
    isIdea && !isFocused && !isActive && !task.isFrog ? styles.priIdea : '',
    !isIdea && !isFocused && !isActive && !task.isFrog ? styles.priNormal : '',
    isProjCard ? styles.hasProject : '',
  ].filter(Boolean).join(' ');

  // Dynamic inline style for project-colored cards
  // --card-strip drives the ::before left edge so CSS classes can't override it with the wrong color
  const cardStyle = isProjCard ? {
    background: `color-mix(in srgb, var(--${projColor}) 5%, transparent)`,
    borderColor: `color-mix(in srgb, var(--${projColor}) 22%, transparent)`,
    '--card-strip': `var(--${projColor})`,
  } : {};

  function handleCheck(e) {
    e.stopPropagation();
    if (isIdea) { markSpecialDone(task.id, !done); return; }
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
    if (done) return;
    e.stopPropagation();
    setNameVal(task.name);
    setEditingName(true);
  }

  function handleNameSave() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== task.name) {
      updateTask(task.id, { name: trimmed });
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

  const starColor = isIdea ? styles.ideaStarOn : styles.starOn;
  // Project tasks use project color for stars
  const starStyle = (!isIdea && projColor) ? { color: `var(--${projColor})` } : {};

  return (
    <div
      className={cardClass}
      style={cardStyle}
      data-taskid={task.id}
      draggable={!editingName && !noDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(dayRecord || isIdea) && (
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
            className={`${styles.taskName} ${done ? styles.doneName : ''} ${!done ? styles.nameClickable : ''}`}
            onClick={handleNameClick}
          >
            {task.name}
          </span>
        )}
        {/* Points + duration badges — not for ideas */}
        {!isIdea && (
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
        {/* Star row — all task types get stars */}
        <div className={styles.starRow}>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map(n => (
              <span
                key={n}
                className={`${styles.star} ${n <= (task.mayaPts ?? 1) ? starColor : ''}`}
                onClick={onStarChange ? (e) => { e.stopPropagation(); onStarChange(task.id, n); } : undefined}
                style={{ ...(n <= (task.mayaPts ?? 1) ? starStyle : {}), ...(onStarChange ? { cursor: 'pointer' } : {}) }}
              >★</span>
            ))}
          </div>
          {showDateChip && task.scheduledDate && (
            <span className={styles.dateChip}>{task.scheduledDate}</span>
          )}
          {task.topic && isIdea && (() => {
            const allTopics = getIdeaTopics();
            const topicObj = allTopics.find(x => x.name?.toLowerCase() === task.topic.toLowerCase());
            const tc = topicObj?.color || 'slv';
            return (
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span
                  className={styles.ideaTopicChip}
                  style={{ background: `color-mix(in srgb, var(--${tc}) 72%, #000)`, cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); if (!topicPickerOpen) setTopicEditVal(task.topic); setTopicPickerOpen(!topicPickerOpen); }}
                >{task.topic}</span>
                {topicPickerOpen && (
                  <div className={styles.topicPicker} onClick={e => e.stopPropagation()} onMouseDown={e => e.preventDefault()}>
                    {/* Rename this topic (updates all cards with same topic) */}
                    <input
                      className={styles.topicPickerInput}
                      value={topicEditVal}
                      onChange={e => setTopicEditVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (topicEditVal.trim() && topicEditVal.trim().toLowerCase() !== task.topic.toLowerCase())
                            editIdeaTopic(task.topic, topicEditVal.trim());
                          setTopicPickerOpen(false);
                        }
                        if (e.key === 'Escape') setTopicPickerOpen(false);
                      }}
                      onBlur={() => {
                        if (topicEditVal.trim() && topicEditVal.trim().toLowerCase() !== task.topic.toLowerCase())
                          editIdeaTopic(task.topic, topicEditVal.trim());
                        setTopicPickerOpen(false);
                      }}
                      autoFocus
                    />
                    {/* Color swatches for this topic */}
                    <div className={styles.topicPickerColors}>
                      {IDEA_PALETTE.map(c => (
                        <span
                          key={c}
                          className={styles.topicPickerSwatch}
                          style={{ background: `var(--${c})`, outline: tc === c ? '2px solid var(--gold)' : 'none', outlineOffset: 1 }}
                          onClick={() => setIdeaTopicColor(task.topic, c)}
                        />
                      ))}
                    </div>
                    {/* Switch to a different topic */}
                    {allTopics.filter(t => t.name.toLowerCase() !== task.topic.toLowerCase()).length > 0 && (
                      <div className={styles.topicPickerSep} />
                    )}
                    {allTopics.filter(t => t.name.toLowerCase() !== task.topic.toLowerCase()).map(t => (
                      <div
                        key={t.name}
                        className={styles.topicPickerItem}
                        style={{ background: `color-mix(in srgb, var(--${t.color || 'slv'}) 72%, #000)` }}
                        onClick={() => { updateTask(task.id, { topic: t.name }); setTopicPickerOpen(false); }}
                      >{t.name}</div>
                    ))}
                    <div className={`${styles.topicPickerItem} ${styles.topicPickerRemove}`}
                      onClick={() => { updateTask(task.id, { topic: null }); setTopicPickerOpen(false); }}
                    >× Remove topic</div>
                  </div>
                )}
              </span>
            );
          })()}
          {!isIdea && task.project && (() => {
            const pc = projColor || 'slv';
            const allProjs = getProjects();
            return (
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span
                  className={styles.projectChip}
                  style={task.project ? { background: `color-mix(in srgb, var(--${pc}) 72%, #000)` } : { background: 'var(--s2)', color: 'var(--t3)', fontSize: 9, padding: '2px 5px', borderRadius: 2, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setProjPickerOpen(!projPickerOpen); }}
                >{task.project || '+ proj'}</span>
                {projPickerOpen && (
                  <div className={styles.projPicker} onClick={e => e.stopPropagation()}>
                    {allProjs.map(p => (
                      <div
                        key={p.name}
                        className={styles.projPickerItem}
                        style={{ color: '#fff', background: `color-mix(in srgb, var(--${p.color || 'slv'}) 72%, #000)` }}
                        onClick={() => { updateTask(task.id, { project: p.name }); setProjPickerOpen(false); }}
                      >{p.name}</div>
                    ))}
                    {task.project && (
                      <div
                        className={styles.projPickerItem}
                        style={{ color: 'var(--t3)', background: 'var(--s2)' }}
                        onClick={() => { updateTask(task.id, { project: null }); setProjPickerOpen(false); }}
                      >None</div>
                    )}
                    {allProjs.length === 0 && <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--t3)' }}>No projects yet</div>}
                  </div>
                )}
              </span>
            );
          })()}
        </div>
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
