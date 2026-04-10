import React from 'react';
import { StyleSheet, View } from 'react-native';
import { expectedDistance, type Activity, type PlannedSession } from '@steady/types';
import { CompactDayRow } from './CompactDayRow';
import { SectionLabel } from '../ui/SectionLabel';
import { addDaysIso, dayIndexForIsoDate, startOfWeekIso } from '../../lib/plan-helpers';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface RemainingDaysListProps {
  sessions: (PlannedSession | null)[];
  today: string;
  activitiesBySessionId?: Map<string, Activity>;
}

function formatShortDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${MONTHS[value.getUTCMonth()].toUpperCase()} ${value.getUTCDate()}`;
}

function statusForDay(
  session: PlannedSession | null,
  dayIndex: number,
  todayIndex: number,
  activity?: Activity,
): 'completed' | 'off-target' | 'missed' | 'today' | 'upcoming' | 'rest' {
  if (!session || session.type === 'REST') return 'rest';
  if (session.actualActivityId) {
    if (activity) {
      const plannedKm = expectedDistance(session);
      if (plannedKm > 0 && Math.abs(activity.distance - plannedKm) / plannedKm > 0.1) {
        return 'off-target';
      }
    }
    return 'completed';
  }
  if (dayIndex < todayIndex) return 'missed';
  if (dayIndex === todayIndex) return 'today';
  return 'upcoming';
}

function formatActualDistance(distance: number | undefined): string | null {
  if (typeof distance !== 'number') return null;
  return `${Number(distance.toFixed(1)).toString()}k`;
}

function formatPlannedDistance(session: PlannedSession | null): string | null {
  if (!session || session.type === 'REST') return null;
  return `${Number(expectedDistance(session).toFixed(1)).toString()}k`;
}

export function RemainingDaysList({
  sessions,
  today,
  activitiesBySessionId,
}: RemainingDaysListProps) {
  const todayIndex = dayIndexForIsoDate(today);
  const weekStart = startOfWeekIso(today);

  return (
    <View style={styles.wrapper}>
      <SectionLabel>This week</SectionLabel>
      {sessions.map((session, index) => {
        const activity = session?.id ? activitiesBySessionId?.get(session.id) : undefined;

        return (
          <CompactDayRow
            key={index}
            dayName={DAYS[index]}
            dateLabel={formatShortDate(addDaysIso(weekStart, index))}
            session={session}
            status={statusForDay(session, index, todayIndex, activity)}
            metricLabel={formatActualDistance(activity?.distance) ?? formatPlannedDistance(session)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 22,
  },
});
