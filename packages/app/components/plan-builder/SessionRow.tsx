import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { TypeStrip } from './TypeStrip';
import { PropagateModal } from './PropagateModal';
import { SessionDot } from '../ui/SessionDot';
import { DAYS, REP_DISTS, TYPE_DEFAULTS } from '../../lib/plan-helpers';
import type { PlannedSession, SessionType } from '@steady/types';

interface SessionRowProps {
  sess: Partial<PlannedSession> | null;
  dayIndex: number;
  weekIndex: number;
  totalWeeks: number;
  onChanged: (dayIndex: number, updated: Partial<PlannedSession> | null, scope: 'this' | 'remaining' | 'build') => void;
}

export function SessionRow({ sess, dayIndex, weekIndex, totalWeeks, onChanged }: SessionRowProps) {
  const [pending, setPending] = useState<{ updated: Partial<PlannedSession> | null; desc: string } | null>(null);

  const currentType: SessionType = (sess?.type as SessionType) || 'REST';
  const isRest = currentType === 'REST';
  const tc = SESSION_TYPE[currentType];
  const isInterval = currentType === 'INTERVAL';

  const fire = (updated: Partial<PlannedSession> | null, desc: string) => {
    setPending({ updated, desc });
  };

  const switchType = (newType: SessionType) => {
    if (newType === currentType) return;
    const defaults = { ...TYPE_DEFAULTS[newType] };
    if (newType !== 'REST' && newType !== 'INTERVAL' && sess?.distance) {
      defaults.distance = sess.distance;
    }
    if (newType !== 'REST' && sess?.pace) {
      defaults.pace = sess.pace;
    }
    fire(newType === 'REST' ? null : defaults, `Change ${DAYS[dayIndex]} to ${SESSION_TYPE[newType].label}`);
  };

  return (
    <>
      <View style={styles.row}>
        <Text style={[styles.dayLabel, { color: tc.color }]}>{DAYS[dayIndex]}</Text>
        <TypeStrip selected={currentType} onSelect={switchType} />

        {!isRest && (
          <>
            {isInterval ? (
              <View style={styles.intervalControls}>
                <View style={styles.repStepper}>
                  <Pressable
                    onPress={() =>
                      fire(
                        { ...sess, reps: Math.max(2, (sess?.reps ?? 6) - 1) },
                        `${Math.max(2, (sess?.reps ?? 6) - 1)}×${sess?.repDist ?? 800}m on ${DAYS[dayIndex]}`,
                      )
                    }
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.repValue}>{sess?.reps ?? 6}</Text>
                  <Text style={styles.repUnit}>reps</Text>
                  <Pressable
                    onPress={() =>
                      fire(
                        { ...sess, reps: Math.min(20, (sess?.reps ?? 6) + 1) },
                        `${Math.min(20, (sess?.reps ?? 6) + 1)}×${sess?.repDist ?? 800}m on ${DAYS[dayIndex]}`,
                      )
                    }
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.repDistRow}>
                  {REP_DISTS.map((d) => (
                    <Pressable
                      key={d}
                      onPress={() =>
                        fire(
                          { ...sess, repDist: d },
                          `${sess?.reps ?? 6}×${d}m on ${DAYS[dayIndex]}`,
                        )
                      }
                      style={[
                        styles.repDistChip,
                        {
                          borderColor: sess?.repDist === d ? C.clay : C.border,
                          backgroundColor: sess?.repDist === d ? C.clayBg : C.cream,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.repDistText,
                          {
                            color: sess?.repDist === d ? C.clay : C.muted,
                            fontWeight: sess?.repDist === d ? '700' : '400',
                          },
                        ]}
                      >
                        {d}m
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.distControls}>
                {[-2, -1].map((delta) => (
                  <Pressable
                    key={delta}
                    onPress={() =>
                      fire(
                        { ...sess, distance: Math.max(2, (sess?.distance ?? 8) + delta) },
                        `${Math.max(2, (sess?.distance ?? 8) + delta)}km on ${DAYS[dayIndex]}`,
                      )
                    }
                    style={styles.distBtn}
                  >
                    <Text style={styles.distBtnText}>−{Math.abs(delta)}</Text>
                  </Pressable>
                ))}
                <Text style={styles.distValue}>{sess?.distance ?? '?'}km</Text>
                {[1, 2].map((delta) => (
                  <Pressable
                    key={delta}
                    onPress={() =>
                      fire(
                        { ...sess, distance: Math.min(40, (sess?.distance ?? 8) + delta) },
                        `${Math.min(40, (sess?.distance ?? 8) + delta)}km on ${DAYS[dayIndex]}`,
                      )
                    }
                    style={styles.distBtn}
                  >
                    <Text style={styles.distBtnText}>+{delta}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {pending && (
        <PropagateModal
          changeDesc={pending.desc}
          weekIndex={weekIndex}
          totalWeeks={totalWeeks}
          onApply={(scope) => {
            onChanged(dayIndex, pending.updated, scope);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dayLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    marginBottom: 8,
  },
  intervalControls: {
    marginTop: 10,
    gap: 8,
  },
  repStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cream,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  stepBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    color: C.clay,
  },
  repValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink,
    paddingHorizontal: 4,
  },
  repUnit: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
    marginRight: 4,
  },
  repDistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  repDistChip: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  repDistText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  distControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  distBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
  },
  distValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
    minWidth: 52,
    textAlign: 'center',
  },
});
