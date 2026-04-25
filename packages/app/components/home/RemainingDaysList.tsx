import React from 'react';
import { StyleSheet, View } from 'react-native';
import { expectedDistance, type PlannedSession } from '@steady/types';
import { CompactDayRow } from './CompactDayRow';
import { SectionLabel } from '../ui/SectionLabel';
import { addDaysIso, dayIndexForIsoDate } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance } from '../../lib/units';
import type { ActivityDayStatus } from '../../features/run/activity-resolution';
import { canOpenHomeSessionRow } from '../../features/home/resolve-session';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface RemainingDaysListProps {
  sessions: (PlannedSession | null)[];
  today: string;
  weekStartDate: string;
  activityForSession: (session: PlannedSession | null) => { distance: number } | undefined;
  activityIdForSession: (session: PlannedSession | null) => string | null;
  statusForDay: (
    session: PlannedSession | null,
    dayIndex: number,
    todayIndex: number,
  ) => ActivityDayStatus;
  onSessionPress?: (session: PlannedSession, status: ActivityDayStatus) => void;
}

function formatShortDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${MONTHS[value.getUTCMonth()].toUpperCase()} ${value.getUTCDate()}`;
}

function formatActualDistance(distance: number | undefined, units: 'metric' | 'imperial'): string | null {
  if (typeof distance !== 'number') return null;
  return formatDistance(distance, units, { compactMetric: true });
}

function formatPlannedDistance(
  session: PlannedSession | null,
  units: 'metric' | 'imperial',
): string | null {
  if (!session || session.type === 'REST') return null;
  return formatDistance(expectedDistance(session), units, { compactMetric: true });
}

export function RemainingDaysList({
  sessions,
  today,
  weekStartDate,
  activityForSession,
  activityIdForSession,
  statusForDay,
  onSessionPress,
}: RemainingDaysListProps) {
  const { units } = usePreferences();
  const todayIndex = dayIndexForIsoDate(today);

  return (
    <View style={styles.wrapper}>
      <SectionLabel>This week</SectionLabel>
      {sessions.map((session, index) => {
        const activity = activityForSession(session);
        const status = statusForDay(session ?? null, index, todayIndex);
        const hasRunDetail = session ? Boolean(activityIdForSession(session)) : false;
        const isPressable = canOpenHomeSessionRow({
          session: session ?? null,
          status,
          hasRunDetail,
        });

        return (
          <CompactDayRow
            key={index}
            dayName={DAYS[index]}
            dateLabel={formatShortDate(addDaysIso(weekStartDate, index))}
            session={session ?? null}
            status={status}
            metricLabel={formatActualDistance(activity?.distance, units) ?? formatPlannedDistance(session, units)}
            onPress={session && isPressable ? () => onSessionPress?.(session, status) : undefined}
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
