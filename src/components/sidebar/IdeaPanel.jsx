import { useState, useRef } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import iStyles from '../../styles/components/IdeaPanel.module.css';
import dStyles from '../../styles/components/DayView.module.css';
import TaskCard from '../task/TaskCard.jsx';
import { saveTask, updateTask, moveTask, sortTasksForView, getIdeaTopics, addIdeaTopic, editIdeaTopic, deleteIdeaTopic, setIdeaTopicColor } from '../../store/store.js';
import { uid } from '../../utils/dates.js';
import { applyEmDash } from '../../utils/parsing.js';
import { doMove, insertAtForStars } from '../../utils/taskPlacement.js';

const TOPIC_COLORS = ['gold', 'hot', 'ora', 'yel', 'grn', 'tel', 'blu', 'pur', 'pnk', 'ind', 'slv', 'brn'];

function snapToStarZone(insertAt, zoneList, stars) {
  let lo = 0, hi = zoneList.length;
  for (let i = 0; i < zoneList.length; i++) {
    const r = zoneList[i].mayaPts ?? 1;
    if (r > stars) lo = i + 1;
    if (r < stars && hi === zoneList.length) hi = i;
  }
  return Math.min(Math.max(insertAt, lo), hi);
}

function insertTopOfStarGroup(stars, zoneList) {
  let lo = 0;
  for (let i = 0; i < zoneList.length; i++) {
    if ((zoneList[i].mayaPts ?? 1) > stars) lo = i + 1;
  }
  return lo;
}

export default function IdeaPanel({
  tasks,
  activeTaskId,
  focusedTaskId,
  onContextMenu,
}) {
  const [inputVal, setInputVal] = useState('');
  const [sortGrp, setSortGrp] = useState('desc');
  const [sortTopic, setSortTopic] = useState('desc');
  const [filterTopic, setFilterTopic] = useState(null);
  const inputRef = useRef(null);
  const dragOverCardRef = useRef(null);

  // Topic combobox state
  const [topicInput, setTopicInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicDropOpen, setTopicDropOpen] = useState(false);
  const [editingTopicIdx, setEditingTopicIdx] = useState(-1);
  const [editTopicVal, setEditTopicVal] = useState('');
  const [colorPickingIdx, setColorPickingIdx] = useState(-1);
  const closeTimeoutRef = useRef(null);

  const ideaTasks = tasks.filter(t => t.priority === 'idea' && !t.done);
  const iq = inputVal.trim().toLowerCase();
  let displayIdea = iq ? ideaTasks.filter(t => t.name.toLowerCase().includes(iq)) : ideaTasks;
  if (filterTopic) {
    displayIdea = displayIdea.filter(t => t.topic && t.topic.toLowerCase() === filterTopic.toLowerCase());
  }

  const allTopics = getIdeaTopics();
  const filteredTopics = topicInput.trim()
    ? allTopics.filter(t => t.name.toLowerCase().includes(topicInput.trim().toLowerCase()))
    : allTopics;

  // Unique topic names for filter chips
  const usedTopicNames = [...new Set(ideaTasks.map(t => t.topic).filter(Boolean))];

  function clearCardIndicator() {
    if (dragOverCardRef.current) {
      dragOverCardRef.current.style.borderTop = '';
      dragOverCardRef.current.style.borderBottom = '';
      dragOverCardRef.current = null;
    }
  }

  function resolveTopicOnSubmit() {
    if (selectedTopic) return selectedTopic;
    const typed = topicInput.trim();
    if (!typed) return null;
    const existing = allTopics.find(t => t.name.toLowerCase() === typed.toLowerCase());
    if (existing) return existing.name;
    addIdeaTopic(typed);
    return typed;
  }

  function handleAdd() {
    const raw = inputVal.trim();
    if (!raw) return;
    const topic = resolveTopicOnSubmit();
    const newId = uid();
    saveTask({
      id: newId,
      name: raw,
      pts: 1,
      timeEstimate: null,
      isFrog: false,
      priority: 'idea',
      mayaPts: 1,
      scheduledDate: null,
      createdAt: new Date().toISOString(),
      topic: topic || null,
    });
    doMove(newId, insertTopOfStarGroup(1, ideaTasks), ideaTasks);
    setInputVal('');
    setTopicInput('');
    setSelectedTopic(null);
    closeDropdown();
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }

  function handleStarChange(taskId, n) {
    updateTask(taskId, { mayaPts: n });
    const zone = ideaTasks.filter(t => t.id !== taskId);
    doMove(taskId, insertAtForStars(n, zone), zone);
  }

  function handleBump(taskId, dir) {
    const idx = ideaTasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const stars = ideaTasks[idx].mayaPts ?? 1;
    let lo = 0, hi = ideaTasks.length;
    for (let i = 0; i < ideaTasks.length; i++) {
      const r = ideaTasks[i].mayaPts ?? 1;
      if (r > stars) lo = i + 1;
      if (r < stars && hi === ideaTasks.length) hi = i;
    }
    let targetPos;
    if (dir === 'up') targetPos = Math.max(lo, idx - 1);
    else if (dir === 'down') targetPos = Math.min(hi - 1, idx + 1);
    else if (dir === 'top') targetPos = lo;
    else targetPos = hi - 1;
    if (targetPos === idx) return;
    doMove(taskId, targetPos, ideaTasks.filter(t => t.id !== taskId));
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
      cardEl.style.borderTop = before ? '2px solid var(--pri-idea)' : '';
      cardEl.style.borderBottom = before ? '' : '2px solid var(--pri-idea)';
    } else {
      const cards = zone.querySelectorAll('[data-taskid]');
      if (cards.length === 0) { clearCardIndicator(); return; }
      const firstCard = cards[0], lastCard = cards[cards.length - 1];
      const firstRect = firstCard.getBoundingClientRect();
      if (e.clientY <= firstRect.top + firstRect.height / 2) {
        if (dragOverCardRef.current !== firstCard) { clearCardIndicator(); dragOverCardRef.current = firstCard; }
        firstCard.style.borderTop = '2px solid var(--pri-idea)';
        firstCard.style.borderBottom = '';
      } else {
        if (dragOverCardRef.current !== lastCard) { clearCardIndicator(); dragOverCardRef.current = lastCard; }
        lastCard.style.borderBottom = '2px solid var(--pri-idea)';
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
    if (!draggedTask || draggedTask.priority !== 'idea') { clearCardIndicator(); return; }
    const hoveredCard = dragOverCardRef.current;
    clearCardIndicator();
    const directCard = e.target.closest('[data-taskid]');
    const targetCard = directCard || hoveredCard;
    const draggedStars = draggedTask.mayaPts ?? 1;
    const zoneList = ideaTasks.filter(t => t.id !== id);
    setSortGrp('desc'); setSortTopic('desc');
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

  function handleTextareaChange(e) {
    setInputVal(applyEmDash(e.target.value));
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  function handleTextareaKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  }

  // ── Dropdown close with delay ──────────────────────────────────────────
  function closeDropdown() {
    clearTimeout(closeTimeoutRef.current);
    setTopicDropOpen(false);
    setColorPickingIdx(-1);
  }

  function handleTopicComboLeave() {
    if (editingTopicIdx !== -1 || colorPickingIdx !== -1) return;
    closeTimeoutRef.current = setTimeout(() => {
      setTopicDropOpen(false);
      setColorPickingIdx(-1);
    }, 200);
  }

  function handleTopicComboEnter() {
    clearTimeout(closeTimeoutRef.current);
  }

  // ── Topic combobox handlers ────────────────────────────────────────────
  function handleTopicInputChange(e) {
    setTopicInput(e.target.value);
    setSelectedTopic(null);
    if (!topicDropOpen && allTopics.length > 0) setTopicDropOpen(true);
  }

  function handleTopicInputFocus() {
    if (allTopics.length > 0 && !selectedTopic) setTopicDropOpen(true);
  }

  function handleTopicInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const typed = topicInput.trim();
      if (typed) {
        const existing = allTopics.find(t => t.name.toLowerCase() === typed.toLowerCase());
        if (existing) {
          setSelectedTopic(existing.name);
          setTopicInput('');
        }
      }
      closeDropdown();
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  function handleTopicSelect(topicName) {
    setSelectedTopic(topicName);
    setTopicInput('');
    closeDropdown();
  }

  function handleTopicClear() {
    setSelectedTopic(null);
    setTopicInput('');
  }

  function handleEditTopicStart(idx) {
    setEditingTopicIdx(idx);
    setEditTopicVal(allTopics[idx].name);
    setColorPickingIdx(-1);
  }

  function handleEditTopicSave() {
    if (editingTopicIdx === -1) return;
    const oldName = allTopics[editingTopicIdx].name;
    const newName = editTopicVal.trim();
    if (newName && newName !== oldName) {
      editIdeaTopic(oldName, newName);
      if (selectedTopic && selectedTopic.toLowerCase() === oldName.toLowerCase()) {
        setSelectedTopic(newName);
      }
      if (filterTopic && filterTopic.toLowerCase() === oldName.toLowerCase()) {
        setFilterTopic(newName);
      }
    }
    setEditingTopicIdx(-1);
    setEditTopicVal('');
  }

  function handleDeleteTopic(idx) {
    const name = allTopics[idx].name;
    deleteIdeaTopic(name);
    if (selectedTopic && selectedTopic.toLowerCase() === name.toLowerCase()) {
      setSelectedTopic(null);
    }
    if (filterTopic && filterTopic.toLowerCase() === name.toLowerCase()) {
      setFilterTopic(null);
    }
    setEditingTopicIdx(-1);
    setColorPickingIdx(-1);
  }

  function handleColorPick(idx) {
    setColorPickingIdx(colorPickingIdx === idx ? -1 : idx);
    setEditingTopicIdx(-1);
  }

  function handleColorSelect(topicName, color) {
    setIdeaTopicColor(topicName, color);
    setColorPickingIdx(-1);
  }

  function topicColor(topicName) {
    const t = allTopics.find(x => x.name.toLowerCase() === topicName.toLowerCase());
    return t?.color || 'slv';
  }

  // Inline style for colored chip
  function chipStyle(color) {
    return {
      color: `var(--${color})`,
      background: `color-mix(in srgb, var(--${color}) 10%, transparent)`,
      borderColor: `color-mix(in srgb, var(--${color}) 22%, transparent)`,
    };
  }

  return (
    <div className={`${styles.stabPanel} ${styles.stabPanelActive}`}>
      <div className={styles.panelAdd}>
        {/* Topic combobox */}
        <div className={iStyles.topicCombo} onMouseLeave={handleTopicComboLeave} onMouseEnter={handleTopicComboEnter}>
          {selectedTopic ? (
            <div className={iStyles.topicRow}>
              <span className={iStyles.topicChip} style={chipStyle(topicColor(selectedTopic))}>
                {selectedTopic}
                <span className={iStyles.topicChipX} onClick={handleTopicClear}>&times;</span>
              </span>
            </div>
          ) : (
            <div className={iStyles.topicRow}>
              <input
                className={iStyles.topicInput}
                value={topicInput}
                onChange={handleTopicInputChange}
                onFocus={handleTopicInputFocus}
                onKeyDown={handleTopicInputKeyDown}
                placeholder="topic"
              />
            </div>
          )}
          {topicDropOpen && filteredTopics.length > 0 && (
            <div className={iStyles.topicDrop}>
              {filteredTopics.map((t) => {
                const realIdx = allTopics.indexOf(t);
                return (
                  <div key={t.name} className={iStyles.topicItem}>
                    {editingTopicIdx === realIdx ? (
                      <input
                        className={iStyles.topicEditInput}
                        value={editTopicVal}
                        onChange={e => setEditTopicVal(e.target.value)}
                        onBlur={handleEditTopicSave}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEditTopicSave(); } if (e.key === 'Escape') { setEditingTopicIdx(-1); } }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className={iStyles.topicDot} style={{ background: `var(--${t.color || 'slv'})` }} onClick={() => handleColorPick(realIdx)} />
                        <span className={iStyles.topicItemLabel} onClick={() => handleTopicSelect(t.name)}>{t.name}</span>
                        <span className={iStyles.topicItemActions}>
                          <button className={iStyles.topicItemBtn} onClick={e => { e.stopPropagation(); handleEditTopicStart(realIdx); }} title="Edit">&#9998;</button>
                          <button className={iStyles.topicItemBtn} onClick={e => { e.stopPropagation(); handleDeleteTopic(realIdx); }} title="Delete">&times;</button>
                        </span>
                      </>
                    )}
                    {colorPickingIdx === realIdx && (
                      <div className={iStyles.swatchRow}>
                        {TOPIC_COLORS.map(c => (
                          <span
                            key={c}
                            className={`${iStyles.swatch} ${t.color === c ? iStyles.swatchActive : ''}`}
                            style={{ background: `var(--${c})` }}
                            onClick={e => { e.stopPropagation(); handleColorSelect(t.name, c); }}
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

        {/* Idea input */}
        <div className={styles.qaRow}>
          <textarea
            ref={inputRef}
            className={`${styles.qaInput} ${iStyles.ideaTextarea}`}
            value={inputVal}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            rows={1}
          />
          <button className={`${styles.qaBtn} ${iStyles.ideaBtn}`} onClick={handleAdd}>+</button>
        </div>
        <div className={dStyles.toolbar} style={{ marginTop: '6px' }}>
          <div className={dStyles.toolGroup}>
            <button className={dStyles.sortBtn} title="Sort by topic" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'topic', sortTopic, 'idea'); setSortTopic(sortTopic === 'desc' ? 'asc' : 'desc'); }}>{sortTopic === 'desc' ? 'T\u2193' : 'T\u2191'}</button>
            <button className={dStyles.sortBtn} title="Sort by star group" onClick={e => { e.stopPropagation(); sortTasksForView(null, 'mgrp', sortGrp, 'idea'); setSortGrp(sortGrp === 'desc' ? 'asc' : 'desc'); }}>{sortGrp === 'desc' ? 'G\u2193' : 'G\u2191'}</button>
          </div>
        </div>

        {/* Topic filter chips */}
        {usedTopicNames.length > 0 && (
          <div className={iStyles.filterRow}>
            <span
              className={`${iStyles.filterChip} ${!filterTopic ? iStyles.filterChipActive : ''}`}
              onClick={() => setFilterTopic(null)}
            >All</span>
            {usedTopicNames.map(name => {
              const c = topicColor(name);
              const active = filterTopic && filterTopic.toLowerCase() === name.toLowerCase();
              return (
                <span
                  key={name}
                  className={`${iStyles.filterChip} ${active ? iStyles.filterChipActive : ''}`}
                  style={active ? chipStyle(c) : { color: `var(--${c})` }}
                  onClick={() => setFilterTopic(active ? null : name)}
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
        {ideaTasks.length ? (displayIdea.length ? displayIdea.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            dayRecord={null}
            isActive={t.id === activeTaskId}
            isFocused={t.id === focusedTaskId && t.id !== activeTaskId}
            timerDisplay={null}
            onContextMenu={e => onContextMenu(e, t)}
            inSidebar={true}
            onStarChange={handleStarChange}
            onBump={handleBump}
            noDrag={true}
          />
        )) : <div className={styles.empty}>no ideas match filter</div>) : <div className={styles.empty}>no ideas yet</div>}
      </div>
    </div>
  );
}
