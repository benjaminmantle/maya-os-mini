import { useState } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import DailiesPanel from './DailiesPanel.jsx';
import BacklogPanel from './BacklogPanel.jsx';
import ProjPanel from './ProjPanel.jsx';
import IdeaPanel from './IdeaPanel.jsx';
import { updateTask } from '../../store/store.js';

export default function Sidebar({
  dailies,
  dayRecord,
  focusDate,
  tasks,
  activeTaskId,
  focusedTaskId,
  getTimerDisplay,
  onEditDaily,
  onDailyContextMenu,
  onTaskContextMenu,
  onFocusTask,
  onStartTask,
  theme,
}) {
  const [tab, setTab] = useState('dailies');
  const [backlogDragOver, setBacklogDragOver] = useState(false);
  const [projDragOver, setProjDragOver] = useState(false);

  function handleBacklogDragOver(e) {
    e.preventDefault();
    setBacklogDragOver(true);
  }

  function handleBacklogDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setBacklogDragOver(false);
    }
  }

  function clearFocusAndActive(id) {
    if (focusedTaskId === id && onFocusTask) onFocusTask(id); // toggle off
    if (activeTaskId === id && onStartTask) onStartTask(id); // toggle off
  }

  function handleBacklogDrop(e) {
    e.preventDefault();
    setBacklogDragOver(false);
    const id = e.dataTransfer.getData('tid');
    if (!id) return;
    const task = tasks.find(t => t.id === id);
    if (!task || !task.scheduledDate || task.priority === 'idea') return;
    // Reject project tasks — they belong in Proj tab
    if (task.project) return;
    clearFocusAndActive(id);
    updateTask(id, { scheduledDate: null, isFrog: false });
    setTab('backlog');
  }

  function handleProjDragOver(e) {
    e.preventDefault();
    setProjDragOver(true);
  }

  function handleProjDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setProjDragOver(false);
    }
  }

  function handleProjDrop(e) {
    e.preventDefault();
    setProjDragOver(false);
    const id = e.dataTransfer.getData('tid');
    if (!id) return;
    const task = tasks.find(t => t.id === id);
    if (!task || !task.scheduledDate || task.priority === 'idea') return;
    // Only accept project tasks
    if (!task.project) return;
    clearFocusAndActive(id);
    updateTask(id, { scheduledDate: null, isFrog: false });
    setTab('proj');
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTabs}>
        <button
          className={`${styles.stab} ${tab === 'dailies' ? styles.stabActive : ''}`}
          style={tab === 'dailies' ? { color: 'var(--tel)', borderBottomColor: 'var(--tel)' } : {}}
          onClick={() => setTab('dailies')}
        >
          Day
        </button>
        <button
          className={`${styles.stab} ${tab === 'backlog' ? styles.stabActive : ''} ${backlogDragOver ? styles.stabDragOver : ''}`}
          style={tab === 'backlog' ? { color: 'var(--gold)', borderBottomColor: 'var(--gold)' } : {}}
          onClick={() => setTab('backlog')}
          onDragOver={handleBacklogDragOver}
          onDragLeave={handleBacklogDragLeave}
          onDrop={handleBacklogDrop}
        >
          Tasks
        </button>
        <button
          className={`${styles.stab} ${tab === 'proj' ? styles.stabActive : ''} ${projDragOver ? styles.stabDragOver : ''}`}
          style={tab === 'proj' ? { color: 'var(--pur)', borderBottomColor: 'var(--pur)' } : {}}
          onClick={() => setTab('proj')}
          onDragOver={handleProjDragOver}
          onDragLeave={handleProjDragLeave}
          onDrop={handleProjDrop}
        >
          Proj
        </button>
        <button
          className={`${styles.stab} ${tab === 'idea' ? styles.stabActive : ''}`}
          style={tab === 'idea' ? { color: 'var(--pri-idea)', borderBottomColor: 'var(--pri-idea)' } : {}}
          onClick={() => setTab('idea')}
        >
          Idea
        </button>
      </div>

      {tab === 'dailies' && (
        <DailiesPanel
          dailies={dailies}
          dayRecord={dayRecord}
          focusDate={focusDate}
          onEditDaily={onEditDaily}
          onContextMenu={onDailyContextMenu}
          theme={theme}
        />
      )}
      {tab === 'backlog' && (
        <BacklogPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          focusedTaskId={focusedTaskId}
          getTimerDisplay={getTimerDisplay}
          onContextMenu={onTaskContextMenu}
          focusDate={focusDate}
          onFocusTask={onFocusTask}
          onStartTask={onStartTask}
        />
      )}
      {tab === 'proj' && (
        <ProjPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          focusedTaskId={focusedTaskId}
          getTimerDisplay={getTimerDisplay}
          onContextMenu={onTaskContextMenu}
          onFocusTask={onFocusTask}
          onStartTask={onStartTask}
        />
      )}
      {tab === 'idea' && (
        <IdeaPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          focusedTaskId={focusedTaskId}
          onContextMenu={onTaskContextMenu}
        />
      )}
    </div>
  );
}
