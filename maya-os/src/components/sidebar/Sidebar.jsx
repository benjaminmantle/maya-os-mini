import { useState } from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import DailiesPanel from './DailiesPanel.jsx';
import BacklogPanel from './BacklogPanel.jsx';

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
      </div>

      {tab === 'dailies' ? (
        <DailiesPanel
          dailies={dailies}
          dayRecord={dayRecord}
          focusDate={focusDate}
          onEditDaily={onEditDaily}
          onContextMenu={onDailyContextMenu}
        />
      ) : (
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
    </div>
  );
}
