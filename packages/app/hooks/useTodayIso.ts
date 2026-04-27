import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayIsoLocal } from '../lib/plan-helpers';
import {
  SCREENSHOT_DEMO_TODAY,
  isScreenshotDemoMode,
} from '../demo/screenshot-demo';

function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(nextMidnight.getTime() - now.getTime(), 1_000);
}

export function useTodayIso(): string {
  const demoMode = isScreenshotDemoMode();
  const [today, setToday] = useState(() => (demoMode ? SCREENSHOT_DEMO_TODAY : todayIsoLocal()));

  useEffect(() => {
    if (demoMode) {
      setToday(SCREENSHOT_DEMO_TODAY);
      return;
    }

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
  }, [demoMode]);

  return demoMode ? SCREENSHOT_DEMO_TODAY : today;
}
