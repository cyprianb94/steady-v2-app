import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';

interface ActivitySummary {
  id: string;
  distance: number;
  avgPace: number; // seconds per km
  duration: number; // seconds
  avgHR?: number;
  elevationGain?: number;
}

interface TodayHeroCardProps {
  session: PlannedSession | null;
  activity?: ActivitySummary;
  onPress?: () => void;
}

function formatPace(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function TodayHeroCard({ session, activity, onPress }: TodayHeroCardProps) {
  if (!session || session.type === 'REST') {
    return (
      <View style={[styles.card, { backgroundColor: '#F7F5F1' }]} testID="hero-card">
        <Text style={styles.restTitle}>Rest day</Text>
        <Text style={styles.restSubtitle}>Recovery is part of the plan. You earned this.</Text>
      </View>
    );
  }

  const meta = SESSION_TYPE[session.type];
  const isInterval = session.type === 'INTERVAL';
  const completed = !!session.actualActivityId && !!activity;

  if (completed) {
    return (
      <View style={[styles.card, styles.completedCard, { backgroundColor: meta.bg }]} testID="hero-completed">
        <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.completedBadge}>Completed</Text>
        <Text style={[styles.mainStat, { color: meta.color }]}>
          {activity.distance.toFixed(1)}km @ {formatPace(activity.avgPace)}
        </Text>
        {activity.avgHR ? (
          <Text style={styles.extraText}>{activity.avgHR} bpm avg</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: meta.bg }]} testID="hero-card">
      <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>

      {isInterval ? (
        <Text style={[styles.mainStat, { color: meta.color }]}>
          {session.reps}×{session.repDist}m @ {session.pace}
        </Text>
      ) : (
        <Text style={[styles.mainStat, { color: meta.color }]}>
          {session.distance}km @ {session.pace}
        </Text>
      )}

      {(session.warmup || session.cooldown) && (
        <View style={styles.extras}>
          {session.warmup ? (
            <Text style={styles.extraText}>{session.warmup}km warmup</Text>
          ) : null}
          {session.cooldown ? (
            <Text style={styles.extraText}>{session.cooldown}km cooldown</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    minHeight: 180,
    justifyContent: 'center',
  },
  completedCard: {
    opacity: 0.9,
  },
  typeLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  completedBadge: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.forest,
    marginBottom: 6,
  },
  mainStat: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    marginBottom: 12,
  },
  extras: {
    flexDirection: 'row',
    gap: 12,
  },
  extraText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
  restTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
    marginBottom: 6,
  },
  restSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
});
