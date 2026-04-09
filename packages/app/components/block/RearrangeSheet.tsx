import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  detectHardSessionConflicts,
  swapSessions,
  type PlannedSession,
  type SwapLogEntry,
} from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { SESSION_TYPE } from '../../constants/session-types';
import { DAYS, sessionLabel } from '../../lib/plan-helpers';

interface RearrangeSheetProps {
  visible: boolean;
  weekNumber: number;
  sessions: (PlannedSession | null)[];
  onCancel: () => void;
  onDone: (sessions: (PlannedSession | null)[], swapLog: SwapLogEntry[]) => void;
}

interface RearrangeSnapshot {
  sessions: (PlannedSession | null)[];
  swapLog: SwapLogEntry[];
}

export function RearrangeSheet({
  visible,
  weekNumber,
  sessions,
  onCancel,
  onDone,
}: RearrangeSheetProps) {
  const [layout, setLayout] = useState<(PlannedSession | null)[]>(sessions);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [swapLog, setSwapLog] = useState<SwapLogEntry[]>([]);
  const [history, setHistory] = useState<RearrangeSnapshot[]>([]);

  useEffect(() => {
    if (!visible) return;
    setLayout(sessions);
    setSelectedIndex(null);
    setSwapLog([]);
    setHistory([]);
  }, [sessions, visible]);

  const conflicts = useMemo(() => detectHardSessionConflicts(layout), [layout]);

  function handleDayPress(index: number) {
    const tapped = layout[index];
    if (tapped?.actualActivityId) return;

    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }

    if (selectedIndex == null) {
      setSelectedIndex(index);
      return;
    }

    const selected = layout[selectedIndex];
    if (selected?.actualActivityId) {
      setSelectedIndex(null);
      return;
    }

    const nextSwap = { from: selectedIndex, to: index };
    setHistory((current) => [...current, { sessions: layout, swapLog }]);
    setLayout(swapSessions(layout, selectedIndex, index));
    setSwapLog((current) => [...current, nextSwap]);
    setSelectedIndex(null);
  }

  function handleUndo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setLayout(previous.sessions);
    setSwapLog(previous.swapLog);
    setHistory((current) => current.slice(0, -1));
    setSelectedIndex(null);
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Rearrange sessions</Text>
              <Text style={styles.title}>Week {weekNumber}</Text>
            </View>
            <Pressable testID="rearrange-cancel" onPress={onCancel} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
          </View>

          {conflicts.length > 0 ? (
            <View testID="rearrange-conflict-warning" style={styles.warning}>
              <Text style={styles.warningTitle}>Hard sessions are back-to-back</Text>
              <Text style={styles.warningText}>
                {conflicts
                  .map((conflict) => `${DAYS[conflict.firstDayIndex]}-${DAYS[conflict.secondDayIndex]}`)
                  .join(', ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.days}>
            {layout.map((session, index) => {
              const type = session?.type ?? 'REST';
              const locked = Boolean(session?.actualActivityId);
              const selected = selectedIndex === index;

              return (
                <Pressable
                  key={index}
                  testID={`rearrange-day-${index}`}
                  onPress={locked ? undefined : () => handleDayPress(index)}
                  style={[
                    styles.day,
                    selected && styles.daySelected,
                    locked && styles.dayLocked,
                  ]}
                >
                  <View style={styles.dayMeta}>
                    <Text style={styles.dayName}>{DAYS[index]}</Text>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: SESSION_TYPE[type].color },
                        type === 'REST' && styles.dotRest,
                      ]}
                    />
                  </View>
                  <Text style={[styles.session, type === 'REST' && styles.restSession]}>
                    {sessionLabel(session)}
                  </Text>
                  {locked ? <Text style={styles.lockedText}>Completed</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              testID="rearrange-undo"
              onPress={handleUndo}
              style={[styles.secondaryButton, history.length === 0 && styles.disabledButton]}
            >
              <Text style={styles.secondaryButtonText}>Undo</Text>
            </Pressable>
            <Pressable
              testID="rearrange-done"
              onPress={() => onDone(layout, swapLog)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
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
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 18,
    paddingBottom: 28,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
  },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  warning: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${C.clay}55`,
    backgroundColor: C.clayBg,
    padding: 10,
  },
  warningTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  warningText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
    marginTop: 2,
  },
  days: {
    gap: 8,
  },
  day: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  daySelected: {
    borderColor: C.clay,
    borderWidth: 2,
    backgroundColor: C.clayBg,
  },
  dayLocked: {
    opacity: 0.48,
  },
  dayMeta: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
    width: 24,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotRest: {
    backgroundColor: C.slate,
  },
  session: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink,
  },
  restSession: {
    color: C.muted,
  },
  lockedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.42,
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink2,
  },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: C.clay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
