import React from 'react';
import { StyleSheet, View } from 'react-native';
import { expectedDistance, type Activity, type PlannedSession } from '@steady/types';
import { CompactDayRow } from './CompactDayRow';
import { SectionLabel } from '../ui/SectionLabel';
import { addDaysIso, dayIndexForIsoDate, startOfWeekIso } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance } from '../../lib/units';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface RemainingDaysListProps {
  sessions: (PlannedSession | null)[];
  today: string;
  /** Keyed by activity.id — for resolving via session.actualActivityId */
  activitiesById?: Map<string, Activity>;
  /** Keyed by activity.matchedSessionId — legacy fallback */
  activitiesByMatchedSessionId?: Map<string, Activity>;
  /** @deprecated Pass activitiesById + activitiesByMatchedSessionId instead */
  activitiesBySessionId?: Map<string, Activity>;
}

function formatShortDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${MONTHS[value.getUTCMonth()].toUpperCase()} ${value.getUTCDate()}`;
}

function resolveActivity(
  session: PlannedSession | null,
  byId: Map<string, Activity>,
  byMatchedId: Map<string, Activity>,
): Activity | undefined {
  if (!session) return undefined;
  if (session.actualActivityId) return byId.get(session.actualActivityId);
  return byMatchedId.get(session.id);
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
  activitiesById,
  activitiesByMatchedSessionId,
  activitiesBySessionId,
}: RemainingDaysListProps) {
  const { units } = usePreferences();
  const todayIndex = dayIndexForIsoDate(today);
  const weekStart = startOfWeekIso(today);

  // Support legacy single-map prop
  const byId = activitiesById ?? new Map<string, Activity>();
  const byMatchedId = activitiesByMatchedSessionId ?? activitiesBySessionId ?? new Map<string, Activity>();

  return (
    <View style={styles.wrapper}>
      <SectionLabel>This week</SectionLabel>
      {sessions.map((session, index) => {
        const activity = resolveActivity(session, byId, byMatchedId);

        return (
          <CompactDayRow
            key={index}
            dayName={DAYS[index]}
            dateLabel={formatShortDate(addDaysIso(weekStart, index))}
            session={session}
            status={statusForDay(session, index, todayIndex, activity)}
            metricLabel={formatActualDistance(activity?.distance, units) ?? formatPlannedDistance(session, units)}
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
