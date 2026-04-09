import React from 'react';
import { View } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { CompactDayRow } from './CompactDayRow';
import { getRemainingWeekStartIndex } from '../../lib/plan-helpers';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface RemainingDaysListProps {
  sessions: (PlannedSession | null)[];
  today: string;
}

export function RemainingDaysList({ sessions, today }: RemainingDaysListProps) {
  const startIdx = getRemainingWeekStartIndex(sessions, today);

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
