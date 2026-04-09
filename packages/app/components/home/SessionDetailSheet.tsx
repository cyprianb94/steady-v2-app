import React from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';

interface ActivitySplit {
  km: number;
  pace: number;
  hr?: number;
  elevation?: number;
}

interface ActivityData {
  id: string;
  distance: number;
  avgPace: number;
  duration: number;
  avgHR?: number;
  maxHR?: number;
  elevationGain?: number;
  splits?: ActivitySplit[];
}

interface SessionDetailSheetProps {
  visible: boolean;
  session: PlannedSession;
  activity: ActivityData;
  onClose: () => void;
}

function formatPace(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${secs}s`;
}

export function SessionDetailSheet({ visible, session, activity, onClose }: SessionDetailSheetProps) {
  if (!visible) return null;

  const meta = SESSION_TYPE[session.type];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={[styles.title, { color: meta.color }]}>{meta.label}</Text>

          <View style={styles.comparison}>
            <View style={styles.compCol}>
              <Text style={styles.compLabel}>Planned</Text>
              <Text style={styles.compValue}>{session.distance}km</Text>
              <Text style={styles.compSub}>@ {session.pace}</Text>
            </View>
            <View style={styles.compCol}>
              <Text style={styles.compLabel}>Actual</Text>
              <Text style={styles.compValue}>{activity.distance.toFixed(1)}km</Text>
              <Text style={styles.compSub}>@ {formatPace(activity.avgPace)}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{formatDuration(activity.duration)}</Text>
            </View>
            {activity.avgHR != null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Avg HR</Text>
                <Text style={styles.statValue}>{activity.avgHR} bpm</Text>
              </View>
            )}
            {activity.elevationGain != null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Elevation</Text>
                <Text style={styles.statValue}>{activity.elevationGain}m</Text>
              </View>
            )}
          </View>

          {activity.splits && activity.splits.length > 0 && (
            <View style={styles.splitsSection}>
              <Text style={styles.splitsTitle}>Splits</Text>
              <ScrollView style={styles.splitsList}>
                {activity.splits.map((split) => (
                  <View key={split.km} style={styles.splitRow}>
                    <Text style={styles.splitKm}>km {split.km}</Text>
                    <Text style={styles.splitPace}>{formatPace(split.pace)}</Text>
                    {split.hr != null && (
                      <Text style={styles.splitHr}>{split.hr} bpm</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    marginBottom: 16,
  },
  comparison: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  compCol: {
    flex: 1,
    backgroundColor: C.cream,
    borderRadius: 12,
    padding: 14,
  },
  compLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  compValue: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
  },
  compSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: C.ink,
  },
  splitsSection: {
    marginTop: 4,
  },
  splitsTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
    marginBottom: 8,
  },
  splitsList: {
    maxHeight: 200,
  },
  splitRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 16,
  },
  splitKm: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    width: 40,
  },
  splitPace: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
    width: 50,
  },
  splitHr: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
});
