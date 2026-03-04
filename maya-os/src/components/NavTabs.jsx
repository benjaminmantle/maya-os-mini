import { useState } from 'react';
import styles from '../styles/components/Topbar.module.css';
import { today } from '../utils/dates.js';

export default function NavTabs({ activeView, weekDays, onSwitch, onSwitchDay, onDropToDay }) {
  const [dropHover, setDropHover] = useState(null);
  const todayStr = today();

  function handleDragOver(e, date) {
    e.preventDefault();
    setDropHover(date);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropHover(null);
  }

  function handleDrop(e, date) {
    e.preventDefault();
    setDropHover(null);
    const id = e.dataTransfer.getData('tid');
    if (id) onDropToDay(id, date);
  }

  return (
    <div className={styles.nav}>
      <button
        className={`${styles.navTab} ${activeView === 'day' ? styles.navTabActive : ''}`}
        onClick={() => onSwitch('day')}
      >
        Day
      </button>

      {weekDays.map(date => {
        const d = new Date(date + 'T12:00:00');
        const dayAbbr = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
        const dayNum = d.getDate();
        const isToday = date === todayStr;
        const isDragOver = dropHover === date;
        return (
          <button
            key={date}
            className={[
              styles.navTab,
              styles.navTabDay,
              isToday ? styles.navTabToday : '',
              isDragOver ? styles.navTabDragOver : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSwitchDay(date)}
            onDragOver={e => handleDragOver(e, date)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, date)}
          >
            <span className={styles.navTabDayName}>{dayAbbr}</span>
            <span className={styles.navTabDayNum}>{dayNum}</span>
          </button>
        );
      })}

      <button
        className={`${styles.navTab} ${activeView === 'week' ? styles.navTabActive : ''}`}
        onClick={() => onSwitch('week')}
      >
        Week
      </button>
      <button
        className={`${styles.navTab} ${activeView === 'stats' ? styles.navTabActive : ''}`}
        onClick={() => onSwitch('stats')}
      >
        Settings
      </button>
    </div>
  );
}
