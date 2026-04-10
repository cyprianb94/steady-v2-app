import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayIsoLocal } from '../lib/plan-helpers';

function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(nextMidnight.getTime() - now.getTime(), 1_000);
}

export function useTodayIso(): string {
  const [today, setToday] = useState(() => todayIsoLocal());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(syncToday, msUntilNextLocalMidnight());
    };

    const syncToday = () => {
      setToday(todayIsoLocal());
      scheduleRefresh();
    };

    scheduleRefresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncToday();
      }
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.remove();
    };
  }, []);

  return today;
}
