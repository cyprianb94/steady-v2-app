import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { SectionLabel } from '../ui/SectionLabel';
import { RepStepper } from '../ui/RepStepper';
import { ChipRow } from '../ui/ChipRow';
import { Btn } from '../ui/Btn';
import { ScrollPicker } from './ScrollPicker';
import { TypeStrip } from './TypeStrip';
import { DAYS, REP_DISTS, RECOVERY_OPTS, WU_LIST, KM_LIST, ALL_PACES, sessionLabel } from '../../lib/plan-helpers';
import type { PlannedSession, SessionType } from '@steady/types';

interface SessionEditorProps {
  dayIndex: number;
  existing: Partial<PlannedSession> | null;
  onSave: (dayIndex: number, session: Partial<PlannedSession> | null) => void;
  onClose: () => void;
}

const DEFAULT_PACE: Record<string, string> = {
  EASY: '5:20',
  LONG: '5:10',
  TEMPO: '4:20',
  INTERVAL: '3:50',
};

export function SessionEditor({ dayIndex, existing, onSave, onClose }: SessionEditorProps) {
  const init = existing?.type || 'EASY';
  const [type, setType] = useState<SessionType>(init);
  const [dist, setDist] = useState(String(existing?.distance || 8));
  const [reps, setReps] = useState(existing?.reps || 6);
  const [repDist, setRepDist] = useState(existing?.repDist || 800);
  const [pace, setPace] = useState(existing?.pace || '4:30');
  const [warmup, setWarmup] = useState(String(existing?.warmup || '1.5'));
  const [cooldown, setCooldown] = useState(String(existing?.cooldown || '1'));
  const [recovery, setRecovery] = useState(existing?.recovery || '90s');

  const isInterval = type === 'INTERVAL';
  const isTempo = type === 'TEMPO';
  const isRest = type === 'REST';
  const needsWuCd = isInterval || isTempo;
  const tc = SESSION_TYPE[type];

  useEffect(() => {
    setPace(existing?.pace || DEFAULT_PACE[type] || '4:30');
  }, [type]);

  const build = (): Partial<PlannedSession> | null => {
    if (isRest) return null;
    const s: Partial<PlannedSession> = { type, pace };
    if (isInterval) {
      Object.assign(s, { reps, repDist, recovery, warmup: Number(warmup), cooldown: Number(cooldown) });
    } else if (isTempo) {
      Object.assign(s, { distance: Number(dist), warmup: Number(warmup), cooldown: Number(cooldown) });
    } else {
      s.distance = Number(dist);
    }
    return s;
  };

  const distIndex = KM_LIST.indexOf(dist);
  const paceIndex = ALL_PACES.indexOf(pace);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDay}>{DAYS[dayIndex]}</Text>
            <Text style={[styles.headerTitle, { color: tc.color }]}>
              {isRest ? 'Rest day' : sessionLabel({ type, distance: Number(dist), reps, repDist, pace })}
            </Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Type picker */}
            <View style={styles.section}>
              <SectionLabel>Session type</SectionLabel>
              <TypeStrip selected={type} onSelect={setType} />
            </View>

            {!isRest && (
              <>
                {/* Reps or Distance */}
                <View style={styles.section}>
                  {isInterval ? (
                    <>
                      <SectionLabel>Repetitions</SectionLabel>
                      <View style={styles.repsRow}>
                        <RepStepper value={reps} min={2} max={20} onChange={setReps} />
                        <Text style={styles.repsLabel}>reps</Text>
                      </View>
                      <View style={{ height: 16 }} />
                      <SectionLabel>Rep distance</SectionLabel>
                      <ChipRow
                        chips={REP_DISTS.map((d) => ({
                          key: String(d),
                          label: `${d}m`,
                          color: C.clay,
                        }))}
                        selected={String(repDist)}
                        onSelect={(k) => setRepDist(Number(k))}
                      />
                      <View style={styles.repSummary}>
                        <Text style={styles.repSummaryValue}>
                          {reps}×{repDist}m
                        </Text>
                        <Text style={styles.repSummaryNote}>
                          ≈{Math.round((reps * repDist) / 1000 * 10) / 10}km reps
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <SectionLabel>Distance</SectionLabel>
                      <ScrollPicker
                        items={KM_LIST.map((k) => `${k} km`)}
                        selectedIndex={distIndex >= 0 ? distIndex : 5}
                        onSelect={(i) => setDist(KM_LIST[i])}
                        activeColor={tc.color}
                      />
                    </>
                  )}
                </View>

                {/* Target pace */}
                <View style={styles.section}>
                  <SectionLabel>Target pace</SectionLabel>
                  <ScrollPicker
                    items={ALL_PACES.map((p) => `${p} /km`)}
                    selectedIndex={paceIndex >= 0 ? paceIndex : 20}
                    onSelect={(i) => setPace(ALL_PACES[i])}
                    activeColor={tc.color}
                  />
                  <Text style={styles.paceHint}>
                    {isInterval
                      ? 'per rep effort'
                      : isTempo
                        ? 'sustained effort · Zone 4'
                        : type === 'LONG'
                          ? 'easy long effort · Zone 2'
                          : 'conversational · Zone 2'}
                  </Text>
                </View>

                {/* Recovery (intervals only) */}
                {isInterval && (
                  <View style={styles.section}>
                    <SectionLabel>Recovery between reps</SectionLabel>
                    <ChipRow
                      chips={RECOVERY_OPTS.map((r) => ({ key: r, label: r, color: C.clay }))}
                      selected={recovery}
                      onSelect={setRecovery}
                    />
                  </View>
                )}

                {/* Warmup + Cooldown */}
                {needsWuCd && (
                  <View style={styles.section}>
                    <SectionLabel>Warm-up & cool-down</SectionLabel>
                    <View style={styles.wuCdRow}>
                      <View style={styles.wuCdCol}>
                        <Text style={styles.wuCdLabel}>Warm-up</Text>
                        <ScrollPicker
                          items={WU_LIST.map((w) => `${w} km`)}
                          selectedIndex={WU_LIST.indexOf(warmup as typeof WU_LIST[number]) ?? 3}
                          onSelect={(i) => setWarmup(WU_LIST[i])}
                          activeColor={tc.color}
                        />
                      </View>
                      <View style={styles.wuCdCol}>
                        <Text style={styles.wuCdLabel}>Cool-down</Text>
                        <ScrollPicker
                          items={WU_LIST.map((w) => `${w} km`)}
                          selectedIndex={WU_LIST.indexOf(cooldown as typeof WU_LIST[number]) ?? 2}
                          onSelect={(i) => setCooldown(WU_LIST[i])}
                          activeColor={tc.color}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.actionRow}>
              {existing && existing.type !== 'REST' && (
                <Btn title="Remove" variant="destructive" onPress={() => onSave(dayIndex, null)} />
              )}
              <View style={{ flex: 1 }}>
                <Btn
                  title={existing ? 'Update session' : 'Add session'}
                  onPress={() => onSave(dayIndex, build())}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,21,16,0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerDay: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  repsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  repsLabel: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  repSummary: {
    marginTop: 10,
    backgroundColor: C.clayBg,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  repSummaryValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.clay,
  },
  repSummaryNote: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  paceHint: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 8,
  },
  wuCdRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wuCdCol: {
    flex: 1,
  },
  wuCdLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 8,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
