import type { PlanWeek } from '../plan';
import type { PlannedSession } from '../session';

/**
 * Assign real ISO dates to every session in the plan.
 *
 * The race date falls on the Sunday of the last week.
 * Each week is Mon–Sun (7 slots, index 0 = Monday).
 */
export function assignDates(weeks: PlanWeek[], raceDate: string): PlanWeek[] {
  // Race date = Sunday of the last week
  const race = new Date(raceDate + 'T00:00:00');
  const raceDow = race.getDay(); // 0=Sun
  // Sunday of last week = raceDate if it's a Sunday, otherwise next Sunday
  const lastSunday = new Date(race);
  if (raceDow !== 0) {
    lastSunday.setDate(race.getDate() + (7 - raceDow));
  }
  // Monday of the last week
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  // Monday of week 1
  const week1Monday = new Date(lastMonday);
  week1Monday.setDate(lastMonday.getDate() - (weeks.length - 1) * 7);

  return weeks.map((week, wi) => {
    const weekMonday = new Date(week1Monday);
    weekMonday.setDate(week1Monday.getDate() + wi * 7);

    const sessions = week.sessions.map((s, di) => {
      if (!s) return null;
      const day = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + di);
      const iso = day.toISOString().slice(0, 10);
      return { ...s, date: iso } as PlannedSession;
    });

    return { ...week, sessions };
  });
}
