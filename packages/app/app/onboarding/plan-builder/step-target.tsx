import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { TripleWheelPicker } from '../../../components/plan-builder/TripleWheelPicker';
import { Btn } from '../../../components/ui/Btn';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { C } from '../../../constants/colours';
import { FONTS } from '../../../constants/typography';
import {
  buildGoalParams,
  coerceRace,
  coerceUltraPreset,
  defaultCustomTimeForRace,
  defaultRaceDate,
  defaultTargetForRace,
  formatTargetTime,
  getRaceTargets,
  raceLabelFor,
} from '../../../features/plan-builder/onboarding-flow';
import { todayIsoLocal } from '../../../lib/plan-helpers';

const HOURS = Array.from({ length: 30 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES_SECONDS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

function paramString(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default function StepTarget() {
  const params = useLocalSearchParams<{
    raceDistance?: string;
    raceLabel?: string;
    ultraPreset?: string;
    customUltraDistance?: string;
    raceDate?: string;
    raceName?: string;
  }>();
  const [todayIso] = useState(() => todayIsoLocal());
  const race = coerceRace(params.raceDistance);
  const ultraPreset = coerceUltraPreset(params.ultraPreset);
  const customUltraDistance = paramString(params.customUltraDistance);
  const raceLabel =
    paramString(params.raceLabel) || raceLabelFor(race, ultraPreset, customUltraDistance);
  const raceDate = paramString(params.raceDate, defaultRaceDate(todayIso));
  const raceName = paramString(params.raceName);
  const targets = getRaceTargets(race);
  const allTargets = [...targets, 'Other'];
  const [target, setTarget] = useState(() => defaultTargetForRace(race));
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [customTime, setCustomTime] = useState(() => defaultCustomTimeForRace(race));

  function handleTargetSelect(value: string) {
    if (value === 'Other') {
      setIsCustomTarget(true);
      setCustomTime(defaultCustomTimeForRace(race));
      return;
    }

    setIsCustomTarget(false);
    setTarget(value);
  }

  function handleNext() {
    const goalParams = buildGoalParams({
      race,
      ultraPreset,
      customUltraDistance,
      raceName,
      raceDate,
      targetTime: isCustomTarget ? formatTargetTime(customTime) : target,
      todayIso,
    });

    router.push({
      pathname: '/onboarding/plan-builder/step-base-week',
      params: { ...goalParams },
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.step}>STEP 3 OF 6</Text>
        <Text style={styles.title}>What are you{'\n'}aiming for?</Text>
        <Text style={styles.subtitle}>
          {raceLabel}. Pick the target you want the plan to hold in view.
        </Text>

        <View style={styles.section}>
          <SectionLabel>Target time</SectionLabel>
          <View style={styles.chipsGroup}>
            {allTargets.map((option) => {
              const selected = option === 'Other' ? isCustomTarget : !isCustomTarget && target === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleTargetSelect(option)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.targetChipText, selected && styles.chipSelectedText]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isCustomTarget ? (
            <View style={styles.timePickerWrap}>
              <TripleWheelPicker
                columns={[
                  {
                    items: HOURS,
                    label: 'hrs',
                    selectedIndex: customTime.hours,
                    onSelect: (index) => setCustomTime((current) => ({ ...current, hours: index })),
                  },
                  {
                    items: MINUTES_SECONDS,
                    label: 'min',
                    selectedIndex: customTime.minutes,
                    onSelect: (index) => setCustomTime((current) => ({ ...current, minutes: index })),
                  },
                  {
                    items: MINUTES_SECONDS,
                    label: 'sec',
                    selectedIndex: customTime.seconds,
                    onSelect: (index) => setCustomTime((current) => ({ ...current, seconds: index })),
                  },
                ]}
                activeColor={C.amber}
                borderColor="rgba(212,136,42,0.38)"
                separators={[':', ':']}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Btn title="Build base week →" onPress={handleNext} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 120,
  },
  step: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.clay,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 29,
    color: C.ink,
    lineHeight: 33,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    marginBottom: 32,
  },
  section: {
    marginBottom: 18,
  },
  chipsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipSelected: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  chipSelectedText: {
    color: C.clay,
    fontFamily: FONTS.monoBold,
  },
  targetChipText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink2,
  },
  timePickerWrap: {
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: C.cream,
    borderTopWidth: 1,
    borderTopColor: `${C.border}AA`,
  },
});
