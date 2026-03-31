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
  theme,
}) {
  const [tab, setTab] = useState('dailies');
  const [backlogDragOver, setBacklogDragOver] = useState(false);

  function handleBacklogDragOver(e) {
    e.preventDefault();
    setBacklogDragOver(true);
  }

  function handleBacklogDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setBacklogDragOver(false);
    }
  }

  function handleBacklogDrop(e) {
    e.preventDefault();
    setBacklogDragOver(false);
    const id = e.dataTransfer.getData('tid');
    if (!id) return;
    const task = tasks.find(t => t.id === id);
    if (!task || !task.scheduledDate || task.priority === 'idea') return;
    updateTask(id, { scheduledDate: null, isFrog: false });
    setTab('backlog');
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
          className={`${styles.stab} ${tab === 'proj' ? styles.stabActive : ''}`}
          style={tab === 'proj' ? { color: 'var(--pur)', borderBottomColor: 'var(--pur)' } : {}}
          onClick={() => setTab('proj')}
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
        />
      )}
      {tab === 'proj' && (
        <ProjPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          focusedTaskId={focusedTaskId}
          getTimerDisplay={getTimerDisplay}
          onContextMenu={onTaskContextMenu}
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
