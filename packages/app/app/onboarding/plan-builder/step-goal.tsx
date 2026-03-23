import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { C } from '../../../constants/colours';
import { FONTS } from '../../../constants/typography';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Btn } from '../../../components/ui/Btn';
import { PhaseEditor } from '../../../components/plan-builder/PhaseEditor';
import { ScrollPicker } from '../../../components/plan-builder/ScrollPicker';
import { RACE_TARGETS } from '../../../lib/plan-helpers';
import { defaultPhases } from '@steady/types';
import type { PhaseConfig } from '@steady/types';

const RACES = ['5K', '10K', 'Half Marathon', 'Marathon'] as const;
const WEEK_RANGE = Array.from({ length: 17 }, (_, i) => String(i + 8)); // 8-24

export default function StepGoal() {
  const [race, setRace] = useState('Marathon');
  const [weeks, setWeeks] = useState(16);
  const [target, setTarget] = useState('sub-3:30');
  const [phases, setPhases] = useState<PhaseConfig>(() => defaultPhases(16));
  const [showPhases, setShowPhases] = useState(false);

  const targets = RACE_TARGETS[race] || [];

  const handleWeeksChange = (index: number) => {
    const w = index + 8;
    setWeeks(w);
    setPhases(defaultPhases(w));
  };

  const handleRaceChange = (r: string) => {
    setRace(r);
    const t = RACE_TARGETS[r] || [];
    setTarget(t[2] || t[0] || '');
  };

  const handleNext = () => {
    router.push({
      pathname: '/onboarding/plan-builder/step-template',
      params: {
        race,
        weeks: String(weeks),
        target,
        phases: JSON.stringify(phases),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Text style={styles.step}>STEP 1 OF 3</Text>
        <Text style={styles.title}>What are you training for?</Text>

        {/* Race distance */}
        <View style={styles.section}>
          <SectionLabel>Race distance</SectionLabel>
          <View style={styles.raceRow}>
            {RACES.map((r) => (
              <Pressable
                key={r}
                onPress={() => handleRaceChange(r)}
                style={[
                  styles.raceChip,
                  {
                    borderColor: race === r ? C.clay : C.border,
                    backgroundColor: race === r ? C.clayBg : C.cream,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.raceChipText,
                    { color: race === r ? C.clay : C.muted, fontWeight: race === r ? '700' : '400' },
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Target time */}
        <View style={styles.section}>
          <SectionLabel>Target time</SectionLabel>
          <View style={styles.targetRow}>
            {targets.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTarget(t)}
                style={[
                  styles.targetChip,
                  {
                    borderColor: target === t ? C.amber : C.border,
                    backgroundColor: target === t ? C.amberBg : C.cream,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.targetChipText,
                    { color: target === t ? C.amber : C.muted, fontWeight: target === t ? '700' : '400' },
                  ]}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Weeks to race */}
        <View style={styles.section}>
          <SectionLabel>Weeks to race</SectionLabel>
          <ScrollPicker
            items={WEEK_RANGE.map((w) => `${w} weeks`)}
            selectedIndex={weeks - 8}
            onSelect={handleWeeksChange}
            activeColor={C.clay}
          />
        </View>

        {/* Phase editor toggle */}
        <View style={styles.section}>
          <Pressable onPress={() => setShowPhases(!showPhases)} style={styles.phaseToggle}>
            <Text style={styles.phaseToggleText}>
              {showPhases ? 'Hide phase breakdown' : 'Customise phases'}
            </Text>
            <Text style={styles.phaseToggleArrow}>{showPhases ? '▲' : '▼'}</Text>
          </Pressable>
          {showPhases && (
            <View style={{ marginTop: 12 }}>
              <PhaseEditor phases={phases} totalWeeks={weeks} onChange={setPhases} />
            </View>
          )}
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <View style={styles.infoDot} />
          <Text style={styles.infoText}>
            <Text style={styles.infoStrong}>Steady</Text> — {weeks}-week {race} plan targeting{' '}
            {target}. Your template week repeats with progressive overload through the build phase,
            then tapers before race day.
          </Text>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <Btn title="Build my template week →" onPress={handleNext} fullWidth />
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
    padding: 18,
    paddingTop: 60,
  },
  step: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
    marginBottom: 20,
    lineHeight: 30,
  },
  section: {
    marginBottom: 20,
  },
  raceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  raceChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  raceChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  targetChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  phaseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phaseToggleText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.clay,
  },
  phaseToggleArrow: {
    fontSize: 10,
    color: C.clay,
  },
  infoBox: {
    backgroundColor: C.forestBg,
    borderWidth: 1,
    borderColor: `${C.forest}25`,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.forest,
    marginTop: 5,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    color: C.ink2,
    lineHeight: 19,
  },
  infoStrong: {
    color: C.forest,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
