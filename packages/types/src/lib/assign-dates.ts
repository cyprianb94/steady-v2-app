import type { PlanWeek } from '../plan';
import type { PlannedSession } from '../session';
import { normalizeSessionIds } from './normalize-session-ids';

/**
 * Assign real ISO dates to every session in the plan.
 *
 * The race date falls on the Sunday of the last week.
 * Each week is Mon–Sun (7 slots, index 0 = Monday).
 */
export function assignDates(weeks: PlanWeek[], raceDate: string): PlanWeek[] {
  // Race date = Sunday of the last week
  const race = new Date(`${raceDate}T00:00:00Z`);
  const raceDow = race.getUTCDay(); // 0=Sun
  // Sunday of last week = raceDate if it's a Sunday, otherwise next Sunday
  const lastSunday = new Date(race);
  if (raceDow !== 0) {
    lastSunday.setUTCDate(race.getUTCDate() + (7 - raceDow));
  }
  // Monday of the last week
  const lastMonday = new Date(lastSunday);
  lastMonday.setUTCDate(lastSunday.getUTCDate() - 6);

  // Monday of week 1
  const week1Monday = new Date(lastMonday);
  week1Monday.setUTCDate(lastMonday.getUTCDate() - (weeks.length - 1) * 7);

  const dated = weeks.map((week, wi) => {
    const weekMonday = new Date(week1Monday);
    weekMonday.setUTCDate(week1Monday.getUTCDate() + wi * 7);

    const sessions = week.sessions.map((s, di) => {
      if (!s) return null;
      const day = new Date(weekMonday);
      day.setUTCDate(weekMonday.getUTCDate() + di);
      const iso = day.toISOString().slice(0, 10);
      return { ...s, date: iso } as PlannedSession;
    });

    return { ...week, sessions };
  });

  return normalizeSessionIds(dated);
}
