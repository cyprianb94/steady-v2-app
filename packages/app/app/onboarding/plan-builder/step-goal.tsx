import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Btn } from '../../../components/ui/Btn';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { C } from '../../../constants/colours';
import { FONTS } from '../../../constants/typography';
import {
  PLAN_BUILDER_RACES,
  ULTRA_PRESETS,
  coerceUltraPreset,
  raceLabelFor,
  type PlanBuilderRace,
  type UltraPreset,
} from '../../../features/plan-builder/onboarding-flow';

export default function StepGoal() {
  const [race, setRace] = useState<PlanBuilderRace>('Marathon');
  const [ultraPreset, setUltraPreset] = useState<UltraPreset>('100K');
  const [customUltraDistance, setCustomUltraDistance] = useState('');

  const raceLabel = raceLabelFor(race, ultraPreset, customUltraDistance);
  const customUltraMissing = race === 'Ultra' && ultraPreset === 'Custom' && !customUltraDistance.trim();

  function handleRaceChange(nextRace: PlanBuilderRace) {
    setRace(nextRace);
    setUltraPreset((current) => coerceUltraPreset(current));
  }

  function handleNext() {
    if (customUltraMissing) {
      return;
    }

    router.push({
      pathname: '/onboarding/plan-builder/step-date',
      params: {
        raceDistance: race,
        raceLabel,
        ultraPreset,
        customUltraDistance: customUltraDistance.trim(),
      },
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.step}>STEP 1 OF 6</Text>
        <Text style={styles.title}>What are you{'\n'}training for?</Text>
        <Text style={styles.subtitle}>
          Choose the race distance. The rest of the block follows from this.
        </Text>

        <View style={styles.section}>
          <SectionLabel>Race distance</SectionLabel>
          <View style={styles.chipsGroup}>
            {PLAN_BUILDER_RACES.map((option) => {
              const selected = race === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleRaceChange(option)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {race === 'Ultra' ? (
            <View style={styles.ultraPanel}>
              <Text style={styles.ultraPanelLabel}>Ultra distance</Text>
              <View style={styles.ultraChips}>
                {ULTRA_PRESETS.map((option) => {
                  const selected = ultraPreset === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setUltraPreset(option)}
                      style={[styles.ultraChip, selected && styles.ultraChipSelected]}
                    >
                      <Text style={[styles.ultraChipText, selected && styles.ultraChipTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {ultraPreset === 'Custom' ? (
                <TextInput
                  value={customUltraDistance}
                  onChangeText={setCustomUltraDistance}
                  placeholder="e.g. 80K or 100K"
                  placeholderTextColor={C.muted}
                  selectionColor={C.metricDistance}
                  style={styles.customDistanceInput}
                  testID="ultra-distance-input"
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Btn title="Continue →" onPress={handleNext} fullWidth disabled={customUltraMissing} />
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
    borderColor: C.metricDistance,
    backgroundColor: `${C.metricDistance}14`,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink2,
  },
  chipTextSelected: {
    color: C.metricDistance,
    fontFamily: FONTS.sansSemiBold,
  },
  ultraPanel: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${C.metricDistance}24`,
    backgroundColor: `${C.metricDistance}0F`,
    padding: 12,
  },
  ultraPanelLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.metricDistance,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  ultraChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ultraChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: `${C.metricDistance}28`,
    backgroundColor: C.surface,
  },
  ultraChipSelected: {
    borderColor: C.metricDistance,
    backgroundColor: C.metricDistance,
  },
  ultraChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.ink2,
  },
  ultraChipTextSelected: {
    color: C.surface,
    fontFamily: FONTS.sansSemiBold,
  },
  customDistanceInput: {
    marginTop: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: `${C.metricDistance}30`,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
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
