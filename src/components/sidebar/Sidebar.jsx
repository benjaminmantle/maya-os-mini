import { useState } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import DailiesPanel from './DailiesPanel.jsx';
import BacklogPanel from './BacklogPanel.jsx';
import MayaPanel from './MayaPanel.jsx';
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
    if (!task || !task.scheduledDate || task.priority === 'maya') return; // maya tasks stay in maya
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
          Dailies
        </button>
        <button
          className={`${styles.stab} ${tab === 'backlog' ? styles.stabActive : ''} ${backlogDragOver ? styles.stabDragOver : ''}`}
          onClick={() => setTab('backlog')}
          onDragOver={handleBacklogDragOver}
          onDragLeave={handleBacklogDragLeave}
          onDrop={handleBacklogDrop}
        >
          Backlog
        </button>
        <button
          className={`${styles.stab} ${tab === 'maya' ? styles.stabActive : ''}`}
          style={tab === 'maya' ? { color: 'var(--pri-maya)', borderBottomColor: 'var(--pri-maya)' } : {}}
          onClick={() => setTab('maya')}
        >
          Maya
        </button>
      </div>

      {tab === 'dailies' && (
        <DailiesPanel
          dailies={dailies}
          dayRecord={dayRecord}
          focusDate={focusDate}
          onEditDaily={onEditDaily}
          onContextMenu={onDailyContextMenu}
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
      {tab === 'maya' && (
        <MayaPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          focusedTaskId={focusedTaskId}
          getTimerDisplay={getTimerDisplay}
          onContextMenu={onTaskContextMenu}
        />
      )}
    </div>
  );
}
