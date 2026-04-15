import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { SessionDot } from '../ui/SessionDot';
import { sessionLabel } from '../../lib/plan-helpers';
import type { PlannedSession } from '@steady/types';
import { usePreferences } from '../../providers/preferences-context';

interface DayCardProps {
  session: PlannedSession | null;
  dayName: string;
  isToday: boolean;
  onPress?: () => void;
  muted?: boolean;
}

export function DayCard({ session, dayName, isToday, onPress, muted = false }: DayCardProps) {
  const { units } = usePreferences();
  const isRest = !session || session.type === 'REST';
  const isOpenable = !isRest && typeof onPress === 'function';
  const tc = session ? SESSION_TYPE[session.type] : null;
  const hasActual = !!session?.actualActivityId;

  return (
    <Pressable
      onPress={onPress}
      disabled={!isOpenable}
      style={[
        styles.card,
        {
          backgroundColor: muted
            ? C.surface
            : isToday
              ? '#FFFDF8'
              : isRest
                ? C.cream
                : tc?.bg || C.cream,
          borderColor: muted ? C.border : isToday ? C.clay : isRest ? C.border : `${tc?.color}35`,
        },
        isToday && styles.todayShadow,
        muted && styles.mutedCard,
      ]}
    >
      <View style={styles.left}>
        <Text
          style={[
            styles.dayName,
            { color: muted ? C.muted : isRest ? C.muted : tc?.color || C.muted },
          ]}
        >
          {dayName}
        </Text>
        {!isRest && <SessionDot type={session.type} size={7} />}
      </View>

      <View style={styles.center}>
        {isRest ? (
            <Text style={styles.restText}>Rest</Text>
        ) : (
          <>
            <Text style={[styles.sessionMain, muted && styles.mutedText]} numberOfLines={1}>
              {sessionLabel(session, units)}
            </Text>
            <Text style={styles.sessionType}>{muted ? 'Planned session' : tc?.label}</Text>
          </>
        )}
      </View>

      <View style={styles.right}>
        {hasActual && <Text style={styles.checkmark}>✓</Text>}
        {isOpenable && <Text style={styles.chevron}>›</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  todayShadow: {
    shadowColor: C.clay,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  mutedCard: {
    opacity: 0.72,
  },
  left: {
    width: 34,
    alignItems: 'flex-start',
    gap: 4,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  center: {
    flex: 1,
    marginLeft: 8,
  },
  restText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  sessionMain: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink,
  },
  sessionType: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 1,
  },
  mutedText: {
    color: C.ink2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkmark: {
    fontSize: 14,
    color: C.forest,
  },
  chevron: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
  },
});
