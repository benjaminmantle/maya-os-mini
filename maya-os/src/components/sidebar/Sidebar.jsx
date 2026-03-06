import { useState } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import DailiesPanel from './DailiesPanel.jsx';
import BacklogPanel from './BacklogPanel.jsx';
import MayaPanel from './MayaPanel.jsx';

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
  onDoubleClick,
}) {
  const [tab, setTab] = useState('dailies');

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTabs}>
        <button
          className={`${styles.stab} ${tab === 'dailies' ? styles.stabActive : ''}`}
          onClick={() => setTab('dailies')}
        >
          Dailies
        </button>
        <button
          className={`${styles.stab} ${tab === 'backlog' ? styles.stabActive : ''}`}
          onClick={() => setTab('backlog')}
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
          onDoubleClick={onDoubleClick}
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
