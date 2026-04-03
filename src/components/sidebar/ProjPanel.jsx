import { useState, useRef } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import pStyles from '../../styles/components/ProjPanel.module.css';
import dStyles from '../../styles/components/DayView.module.css';
import TaskCard from '../task/TaskCard.jsx';
import AssignPopup from '../task/AssignPopup.jsx';
import { saveTask, updateTask, moveTask, sortTasksForView, getProjects, addProject, editProject, deleteProject, setProjectColor } from '../../store/store.js';
import { uid } from '../../utils/dates.js';
import { parseInput, applyEmDash } from '../../utils/parsing.js';
import { starRank, snapToStarZone, insertTopOfStarGroup, insertAtForStars, doMove } from '../../utils/taskPlacement.js';

// Row 1 L→R: red → warm pinks → purple  |  Row 2 reversed (snake R←L): indigo → blues → greens → lime  |  Row 3 L→R: yellow → orange → warm neutrals
const PROJECT_COLORS = [
  'red','hot','crl','pnk','lpnk','mgn','pri-maya','pur',     // row 1 →
  'lim','lgrn','grn','pri-idea','tel','blu','pri-ai','ind',  // row 2 ← (reversed so snake: pur→ind→…→lim→yel)
  'yel','gold','pri-md','ora','ora2','brn','gry','slv',      // row 3 →
];

export default function ProjPanel({
  tasks,
  activeTaskId,
  focusedTaskId,
  getTimerDisplay,
  onContextMenu,
  onFocusTask,
  onStartTask,
}) {
  const [inputVal, setInputVal] = useState('');
  const [assignPopup, setAssignPopup] = useState(null);
  const [sortPts, setSortPts] = useState('desc');
  const [sortDur, setSortDur] = useState('desc');
  const [sortGrp, setSortGrp] = useState('desc');
  const [sortProj, setSortProj] = useState('desc');
  const [filterProj, setFilterProj] = useState(null);
  const inputRef = useRef(null);
  const dragOverCardRef = useRef(null);

  // Project combobox state
  const [projInput, setProjInput] = useState('');
  const [selectedProj, setSelectedProj] = useState(null);
  const [projDropOpen, setProjDropOpen] = useState(false);
  const [editingProjIdx, setEditingProjIdx] = useState(-1);
  const [editProjVal, setEditProjVal] = useState('');
  const [colorPickingIdx, setColorPickingIdx] = useState(-1);
  const closeTimeoutRef = useRef(null);

  // Project tasks: any task with a project field that's not an idea and not done
  const projTasks = tasks.filter(t => !t.scheduledDate && t.priority !== 'idea' && t.project);
  let displayProj = projTasks;
  const mq = inputVal.trim().toLowerCase();
  if (mq) displayProj = displayProj.filter(t => t.name.toLowerCase().includes(mq));
  if (filterProj) displayProj = displayProj.filter(t => t.project && t.project.toLowerCase() === filterProj.toLowerCase());

  const allProjects = getProjects();
  const filteredProjects = projInput.trim()
    ? allProjects.filter(p => p.name.toLowerCase().includes(projInput.trim().toLowerCase()))
    : allProjects;

  const usedProjNames = [...new Set(projTasks.map(t => t.project).filter(Boolean))];

  function clearCardIndicator() {
    if (dragOverCardRef.current) {
      dragOverCardRef.current.style.borderTop = '';
      dragOverCardRef.current.style.borderBottom = '';
      dragOverCardRef.current = null;
    }
  }

  function resolveProjOnSubmit() {
    if (selectedProj) return selectedProj;
    const typed = projInput.trim();
    if (!typed) return null;
    const existing = allProjects.find(p => p.name.toLowerCase() === typed.toLowerCase());
    if (existing) return existing.name;
    addProject(typed);
    return typed;
  }

  function handleAdd() {
    const raw = inputVal.trim();
    if (!raw) return;
    const p = parseInput(raw, getProjects());
    const stars = p.stars ?? 1;
    // #syntax project overrides combobox selection
    const project = p.project || resolveProjOnSubmit();
    if (!project) return; // Require a project in the Proj tab
    const newId = uid();
    saveTask({
      id: newId,
      name: p.name,
      pts: p.pts,
      timeEstimate: p.time || null,
      isFrog: p.isFrog,
      priority: null,
      mayaPts: stars,
      scheduledDate: null,
      createdAt: new Date().toISOString(),
      project: project || null,
    });
    doMove(newId, insertTopOfStarGroup(stars, projTasks), projTasks);
    setInputVal('');
    setProjInput('');
    setSelectedProj(null);
    closeDropdown();
  }

  function handleStarChange(taskId, n) {
    updateTask(taskId, { mayaPts: n });
    const zone = projTasks.filter(t => t.id !== taskId);
    doMove(taskId, insertAtForStars(n, zone), zone);
  }

  function handleBump(taskId, dir) {
    const idx = projTasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const rank = starRank(projTasks[idx]);
    let lo = 0, hi = projTasks.length;
    for (let i = 0; i < projTasks.length; i++) {
      const r = starRank(projTasks[i]);
      if (r < rank) lo = i + 1;
      if (r > rank && hi === projTasks.length) hi = i;
    }
    let targetPos;
    if (dir === 'up') targetPos = Math.max(lo, idx - 1);
    else if (dir === 'down') targetPos = Math.min(hi - 1, idx + 1);
    else if (dir === 'top') targetPos = lo;
    else targetPos = hi - 1;
    if (targetPos === idx) return;
    doMove(taskId, targetPos, projTasks.filter(t => t.id !== taskId));
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
      cardEl.style.borderTop = before ? '2px solid var(--pur)' : '';
      cardEl.style.borderBottom = before ? '' : '2px solid var(--pur)';
    } else {
      const cards = zone.querySelectorAll('[data-taskid]');
      if (cards.length === 0) { clearCardIndicator(); return; }
      const firstCard = cards[0], lastCard = cards[cards.length - 1];
      const firstRect = firstCard.getBoundingClientRect();
      if (e.clientY <= firstRect.top + firstRect.height / 2) {
        if (dragOverCardRef.current !== firstCard) { clearCardIndicator(); dragOverCardRef.current = firstCard; }
        firstCard.style.borderTop = '2px solid var(--pur)';
        firstCard.style.borderBottom = '';
      } else {
        if (dragOverCardRef.current !== lastCard) { clearCardIndicator(); dragOverCardRef.current = lastCard; }
        lastCard.style.borderBottom = '2px solid var(--pur)';
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
    if (!draggedTask || draggedTask.priority === 'idea') { clearCardIndicator(); return; }
    // Reject non-project tasks — they belong in Tasks tab
    if (!draggedTask.project) { clearCardIndicator(); return; }
    if (draggedTask.scheduledDate) {
      if (focusedTaskId === id && onFocusTask) onFocusTask(id);
      if (activeTaskId === id && onStartTask) onStartTask(id);
    }
    const hoveredCard = dragOverCardRef.current;
    clearCardIndicator();
    const directCard = e.target.closest('[data-taskid]');
    const targetCard = directCard || hoveredCard;
    const draggedStars = draggedTask.mayaPts ?? 1;
    const zoneList = projTasks.filter(t => t.id !== id);
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
            updateTask(id, { mayaPts: prevStars });
          } else {
            insertAt = snapToStarZone(insertAt, zoneList, draggedStars);
          }
        } else {
          insertAt = snapToStarZone(insertAt, zoneList, draggedStars);
        }
        // Ensure task has a project if dropped into Proj panel
        if (!draggedTask.project && selectedProj) {
          updateTask(id, { project: selectedProj });
        }
        if (draggedTask.scheduledDate) updateTask(id, { scheduledDate: null, isFrog: false });
        doMove(id, insertAt, zoneList);
      } else {
        if (draggedTask.scheduledDate) updateTask(id, { scheduledDate: null, isFrog: false });
        moveTask(id, targetCard.dataset.taskid, before);
      }
    } else if (draggedTask.scheduledDate) {
      updateTask(id, { scheduledDate: null, isFrog: false });
    }
  }

  // ── Dropdown close with delay ──────────────────────────────────────────
  function closeDropdown() {
    clearTimeout(closeTimeoutRef.current);
    setProjDropOpen(false);
    setColorPickingIdx(-1);
  }

  function handleProjComboLeave() {
    if (editingProjIdx !== -1 || colorPickingIdx !== -1) return;
    closeTimeoutRef.current = setTimeout(() => {
      setProjDropOpen(false);
      setColorPickingIdx(-1);
    }, 200);
  }

  function handleProjComboEnter() { clearTimeout(closeTimeoutRef.current); }

  function handleProjInputChange(e) {
    setProjInput(e.target.value);
    setSelectedProj(null);
    if (!projDropOpen && allProjects.length > 0) setProjDropOpen(true);
  }

  function handleProjInputFocus() {
    if (allProjects.length > 0 && !selectedProj) setProjDropOpen(true);
  }

  function handleProjInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const typed = projInput.trim();
      if (typed) {
        const existing = allProjects.find(p => p.name.toLowerCase() === typed.toLowerCase());
        if (existing) {
          setSelectedProj(existing.name);
          setProjInput('');
        }
      }
      closeDropdown();
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  function handleProjSelect(name) {
    setSelectedProj(name);
    setProjInput('');
    closeDropdown();
  }

  function handleProjClear() {
    setSelectedProj(null);
    setProjInput('');
  }

  function handleEditProjStart(idx) {
    setEditingProjIdx(idx);
    setEditProjVal(allProjects[idx].name);
    setColorPickingIdx(-1);
  }

  function handleEditProjSave() {
    if (editingProjIdx === -1) return;
    const oldName = allProjects[editingProjIdx].name;
    const newName = editProjVal.trim();
    if (newName && newName !== oldName) {
      editProject(oldName, newName);
      if (selectedProj && selectedProj.toLowerCase() === oldName.toLowerCase()) setSelectedProj(newName);
      if (filterProj && filterProj.toLowerCase() === oldName.toLowerCase()) setFilterProj(newName);
    }
    setEditingProjIdx(-1);
    setEditProjVal('');
  }

  function handleDeleteProj(idx) {
    const name = allProjects[idx].name;
    deleteProject(name);
    if (selectedProj && selectedProj.toLowerCase() === name.toLowerCase()) setSelectedProj(null);
    if (filterProj && filterProj.toLowerCase() === name.toLowerCase()) setFilterProj(null);
    setEditingProjIdx(-1);
    setColorPickingIdx(-1);
  }

  function handleColorPick(idx) {
    setColorPickingIdx(colorPickingIdx === idx ? -1 : idx);
    setEditingProjIdx(-1);
  }

  function handleColorSelect(projName, color) {
    setProjectColor(projName, color);
    setColorPickingIdx(-1);
  }

  function projColor(projName) {
    const p = allProjects.find(x => x.name.toLowerCase() === projName.toLowerCase());
    return p?.color || 'slv';
  }

  function chipStyle(color) {
    return {
      color: '#fff',
      background: `color-mix(in srgb, var(--${color}) 72%, #000)`,
      borderColor: `color-mix(in srgb, var(--${color}) 40%, #000)`,
      fontWeight: 600,
      letterSpacing: '.3px',
    };
  }

  return (
    <div className={`${styles.stabPanel} ${styles.stabPanelActive}`}>
      <div className={styles.panelAdd}>
        {/* Project combobox */}
        <div className={pStyles.projCombo} onMouseLeave={handleProjComboLeave} onMouseEnter={handleProjComboEnter}>
          {selectedProj ? (
            <div className={pStyles.projRow}>
              <span className={pStyles.projChip} style={chipStyle(projColor(selectedProj))}>
                {selectedProj}
                <span className={pStyles.projChipX} onClick={handleProjClear}>&times;</span>
              </span>
            </div>
          ) : (
            <div className={pStyles.projRow}>
              <input
                className={pStyles.projInput}
                value={projInput}
                onChange={handleProjInputChange}
                onFocus={handleProjInputFocus}
                onKeyDown={handleProjInputKeyDown}
                placeholder="project"
              />
            </div>
          )}
          {projDropOpen && filteredProjects.length > 0 && (
            <div className={pStyles.projDrop}>
              {filteredProjects.map((p) => {
                const realIdx = allProjects.indexOf(p);
                return (
                  <div key={p.name} className={pStyles.projItem}>
                    {editingProjIdx === realIdx ? (
                      <input
                        className={pStyles.projEditInput}
                        value={editProjVal}
                        onChange={e => setEditProjVal(e.target.value)}
                        onBlur={handleEditProjSave}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEditProjSave(); } if (e.key === 'Escape') { setEditingProjIdx(-1); } }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className={pStyles.projDot} style={{ background: `var(--${p.color || 'slv'})` }} onClick={() => handleColorPick(realIdx)} />
                        <span className={pStyles.projItemLabel} onClick={() => handleProjSelect(p.name)}>{p.name}</span>
                        <span className={pStyles.projItemActions}>
                          <button className={pStyles.projItemBtn} onClick={e => { e.stopPropagation(); handleEditProjStart(realIdx); }} title="Edit">&#9998;</button>
                          <button className={pStyles.projItemBtn} onClick={e => { e.stopPropagation(); handleDeleteProj(realIdx); }} title="Delete">&times;</button>
                        </span>
                      </>
                    )}
                    {colorPickingIdx === realIdx && (
                      <div className={pStyles.swatchRow}>
                        {PROJECT_COLORS.map(c => (
                          <span
                            key={c}
                            className={`${pStyles.swatch} ${p.color === c ? pStyles.swatchActive : ''}`}
                            style={{ background: `var(--${c})` }}
                            onClick={e => { e.stopPropagation(); handleColorSelect(p.name, c); }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task input */}
        <div className={styles.qaRow}>
          <input
            ref={inputRef}
            className={styles.qaInput}
            value={inputVal}
            onChange={e => setInputVal(applyEmDash(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className={styles.qaBtn} onClick={handleAdd}>+</button>
        </div>
        <div className={dStyles.toolbar} style={{ marginTop: '6px' }}>
          <div className={dStyles.toolGroup}>
            <button className={dStyles.sortBtn} title="Sort by points" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'pts', sortPts, 'proj'); setSortPts(sortPts === 'desc' ? 'asc' : 'desc'); }}>{sortPts === 'desc' ? 'P↓' : 'P↑'}</button>
            <button className={dStyles.sortBtn} title="Sort by duration" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'dur', sortDur, 'proj'); setSortDur(sortDur === 'desc' ? 'asc' : 'desc'); }}>{sortDur === 'desc' ? 'T↓' : 'T↑'}</button>
            <button className={dStyles.sortBtn} title="Sort by star group" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'mgrp', sortGrp, 'proj'); setSortGrp(sortGrp === 'desc' ? 'asc' : 'desc'); }}>{sortGrp === 'desc' ? 'G↓' : 'G↑'}</button>
            <button className={dStyles.sortBtn} title="Sort by project" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'proj', sortProj, 'proj'); setSortProj(sortProj === 'desc' ? 'asc' : 'desc'); }}>{sortProj === 'desc' ? 'J↓' : 'J↑'}</button>
          </div>
        </div>

        {/* Project filter chips */}
        {usedProjNames.length > 0 && (
          <div className={pStyles.filterRow}>
            <span
              className={`${pStyles.filterChip} ${pStyles.filterChipAll} ${!filterProj ? pStyles.filterChipActive : ''}`}
              style={!filterProj ? { background: 'var(--s3)', color: 'var(--text)', borderColor: 'var(--b2)' } : {}}
              onClick={() => setFilterProj(null)}
            >ALL</span>
            {usedProjNames.map(name => {
              const c = projColor(name);
              const active = filterProj && filterProj.toLowerCase() === name.toLowerCase();
              return (
                <span
                  key={name}
                  className={`${pStyles.filterChip} ${active ? pStyles.filterChipActive : ''}`}
                  style={active ? chipStyle(c) : { color: `var(--${c})` }}
                  onClick={() => setFilterProj(active ? null : name)}
                >{name}</span>
              );
            })}
          </div>
        )}
      </div>
      <div
        className={`${styles.panelBody} ${dStyles.taskList} ${dStyles.dropZone}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {projTasks.length ? (displayProj.length ? displayProj.map(t => (
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
        )) : <div className={styles.empty}>no projects match filter</div>) : <div className={styles.empty}>no project tasks yet</div>}
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
