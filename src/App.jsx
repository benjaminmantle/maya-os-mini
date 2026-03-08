import { useState, useCallback, useEffect } from 'react';
import { useStore } from './hooks/useStore.js';
import { useTimer } from './hooks/useTimer.js';
import { today, getWeekDays, dayLabel } from './utils/dates.js';
import { updateTask } from './store/store.js';
import { useToast } from './components/shared/Toast.jsx';
import Topbar from './components/Topbar.jsx';
import NavTabs from './components/NavTabs.jsx';
import DayView from './components/day/DayView.jsx';
import WeekView from './components/week/WeekView.jsx';
import StatsView from './components/stats/StatsView.jsx';

export default function App() {
  const state = useStore();
  const showToast = useToast();
  const [view, setView] = useState('day');
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [activeStart, setActiveStart] = useState(null);
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [weekNavDate, setWeekNavDate] = useState(null);
  const weekDays = getWeekDays();
  const [theme, setTheme] = useState(() => localStorage.getItem('maya_theme') || 'dark');

  useEffect(() => {
    if (theme === 'light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.remove('theme-light');
    localStorage.setItem('maya_theme', theme);
  }, [theme]);

  function handleThemeToggle() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  const { getTimerDisplay } = useTimer(activeTaskId, activeStart, state.tasks);

  const handleStartTask = useCallback((id) => {
    if (activeTaskId === id) {
      setActiveTaskId(null);
      setActiveStart(null);
      return;
    }
    setFocusedTaskId(null);
    setActiveTaskId(id);
    setActiveStart(Date.now());
  }, [activeTaskId]);

  const handleFocusTask = useCallback((id) => {
    if (focusedTaskId === id && !activeTaskId) {
      setFocusedTaskId(null);
      return;
    }
    if (activeTaskId) {
      setActiveTaskId(null);
      setActiveStart(null);
    }
    setFocusedTaskId(id);
  }, [focusedTaskId, activeTaskId]);

  function handleSwitchDay(date) {
    setWeekNavDate(date);
    setView('day');
  }

  function handleDropToDay(taskId, date) {
    updateTask(taskId, { scheduledDate: date });
    showToast('→ ' + dayLabel(date));
  }

  return (
    <>
      <Topbar profile={state.profile} theme={theme} onThemeToggle={handleThemeToggle} />
      <NavTabs
        activeView={view}
        weekDays={weekDays}
        onSwitch={setView}
        onSwitchDay={handleSwitchDay}
        onDropToDay={handleDropToDay}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'day' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DayView
              key={weekNavDate || 'day'}
              tasks={state.tasks}
              dailies={state.dailies}
              profile={state.profile}
              target={state.target}
              days={state.days}
              frogsComplete={state.frogsComplete}
              activeTaskId={activeTaskId}
              focusedTaskId={focusedTaskId}
              onStartTask={handleStartTask}
              onFocusTask={handleFocusTask}
              getTimerDisplay={(t) => getTimerDisplay(t)}
              initialDate={weekNavDate}
            />
          </div>
        )}
        {view === 'week' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <WeekView
              tasks={state.tasks}
              dailies={state.dailies}
              days={state.days}
              profile={state.profile}
              target={state.target}
              onGoToDay={handleSwitchDay}
            />
          </div>
        )}
        {view === 'stats' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <StatsView
              profile={state.profile}
              dailies={state.dailies}
              days={state.days}
              target={state.target}
              tasks={state.tasks}
            />
          </div>
        )}
      </div>
    </>
  );
}
