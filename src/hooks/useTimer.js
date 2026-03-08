import { useState, useEffect, useRef } from 'react';
import { parseDurMs, fmtMs, isOpenEnded } from '../utils/duration.js';

export function useTimer(activeTaskId, activeStart, tasks) {
  const [, setTick] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (activeTaskId && activeStart) {
      intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeTaskId, activeStart]);

  function getTimerDisplay(task) {
    if (task.id !== activeTaskId || !activeStart) return null;
    const elapsed = Date.now() - activeStart;
    const dur = task.timeEstimate || '';
    const durMs = parseDurMs(dur);
    const open = isOpenEnded(dur);

    if (dur === '∞') {
      return { text: '∞ ' + fmtMs(elapsed), className: 'timer' };
    } else if (open && durMs) {
      const rem = durMs - elapsed;
      if (rem > 0) return { text: '⏱ ' + fmtMs(rem), className: 'timer' };
      return { text: '✓ +' + fmtMs(-rem), className: 'timer open' };
    } else if (durMs) {
      const rem = durMs - elapsed;
      if (rem >= 0) return { text: '⏱ ' + fmtMs(rem), className: 'timer' };
      return { text: '⏱ +' + fmtMs(-rem), className: 'timer over' };
    } else {
      return { text: '⏱ ' + fmtMs(elapsed), className: 'timer' };
    }
  }

  return { getTimerDisplay };
}
