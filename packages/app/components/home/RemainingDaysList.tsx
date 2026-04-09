import React from 'react';
import { View } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { CompactDayRow } from './CompactDayRow';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface RemainingDaysListProps {
  sessions: (PlannedSession | null)[];
  today: string;
}

export function RemainingDaysList({ sessions, today }: RemainingDaysListProps) {
  // Find today's index by matching session dates
  const todayIdx = sessions.findIndex((s) => s?.date === today);
  // If today isn't found in sessions, show nothing
  const startIdx = todayIdx >= 0 ? todayIdx + 1 : sessions.length;

  const remaining = sessions
    .map((session, i) => ({ session, dayName: DAYS[i], index: i }))
    .filter(({ index }) => index >= startIdx);

  return (
    <View>
      {remaining.map(({ session, dayName, index }) => (
        <CompactDayRow key={index} dayName={dayName} session={session} />
      ))}
    </View>
  );
}
