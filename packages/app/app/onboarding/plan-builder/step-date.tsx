import React, { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RaceDateBottomSheet } from '../../../components/plan-builder/RaceDateBottomSheet';
import { Btn } from '../../../components/ui/Btn';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { C } from '../../../constants/colours';
import { FONTS } from '../../../constants/typography';
import {
  defaultRaceDate,
  coerceRace,
  coerceUltraPreset,
  raceLabelFor,
} from '../../../features/plan-builder/onboarding-flow';
import {
  formatShortDate,
  weeksToRace,
} from '../../../features/plan-builder/race-date';
import { todayIsoLocal } from '../../../lib/plan-helpers';

function paramString(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function SearchIcon() {
  return (
    <View style={styles.searchIcon}>
      <View style={styles.searchCircle} />
      <View style={styles.searchHandle} />
    </View>
  );
}

function CalendarIcon() {
  return (
    <View style={styles.calendarIcon}>
      <View style={styles.calendarTopLine} />
      <View style={[styles.calendarPin, styles.calendarPinLeft]} />
      <View style={[styles.calendarPin, styles.calendarPinRight]} />
    </View>
  );
}

export default function StepDate() {
  const params = useLocalSearchParams<{
    raceDistance?: string;
    raceLabel?: string;
    ultraPreset?: string;
    customUltraDistance?: string;
  }>();
  const [todayIso] = useState(() => todayIsoLocal());
  const race = coerceRace(params.raceDistance);
  const ultraPreset = coerceUltraPreset(params.ultraPreset);
  const customUltraDistance = paramString(params.customUltraDistance);
  const raceLabel =
    paramString(params.raceLabel) || raceLabelFor(race, ultraPreset, customUltraDistance);
  const [raceDate, setRaceDate] = useState(() => defaultRaceDate(todayIso));
  const [raceName, setRaceName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const raceNameInputRef = useRef<TextInput>(null);

  const weeks = weeksToRace(todayIso, raceDate);

  function handleNext() {
    router.push({
      pathname: '/onboarding/plan-builder/step-target',
      params: {
        raceDistance: race,
        raceLabel,
        ultraPreset,
        customUltraDistance,
        raceDate,
        weeks: String(weeks),
        raceName: raceName.trim(),
      },
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.step}>STEP 2 OF 6</Text>
        <Text style={styles.title}>When is{'\n'}race day?</Text>
        <Text style={styles.subtitle}>
          This sets the length of the block. You can still adjust the structure later.
        </Text>

        <View style={styles.section}>
          <SectionLabel>Race date</SectionLabel>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={styles.dateRow}
            testID="race-date-trigger"
          >
            <View>
              <Text style={styles.dateValue}>{formatShortDate(raceDate)}</Text>
              <Text style={styles.dateHint}>{weeks} weeks from now</Text>
            </View>
            <CalendarIcon />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionLabel>Race name</SectionLabel>
          <Pressable
            onPress={() => raceNameInputRef.current?.focus()}
            style={styles.inputBox}
            testID="race-name-field"
          >
            <SearchIcon />
            <TextInput
              ref={raceNameInputRef}
              value={raceName}
              onChangeText={setRaceName}
              placeholder={race === 'Ultra' ? 'e.g. UTMB 2026' : 'e.g. London Marathon'}
              placeholderTextColor={C.muted}
              selectionColor={C.clay}
              style={styles.input}
              testID="race-name-input"
            />
            <Text style={styles.optionalLabel}>optional</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Btn title="Continue →" onPress={handleNext} fullWidth />
      </View>

      <RaceDateBottomSheet
        minDate={todayIso}
        onClose={() => setShowDatePicker(false)}
        onConfirm={setRaceDate}
        open={showDatePicker}
        todayIso={todayIso}
        value={raceDate}
      />
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
    marginBottom: 34,
  },
  section: {
    marginBottom: 28,
  },
  dateRow: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 17,
    color: C.ink,
    marginBottom: 7,
  },
  dateHint: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.metricTime,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink,
    padding: 0,
  },
  optionalLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  searchIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.muted,
  },
  searchHandle: {
    position: 'absolute',
    width: 6,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: C.muted,
    transform: [{ translateX: 4 }, { translateY: 4 }, { rotate: '45deg' }],
  },
  calendarIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1.8,
    borderColor: C.muted,
  },
  calendarTopLine: {
    position: 'absolute',
    left: -1.8,
    right: -1.8,
    top: 7,
    height: 1.8,
    backgroundColor: C.muted,
  },
  calendarPin: {
    position: 'absolute',
    top: -3,
    width: 1.8,
    height: 6,
    backgroundColor: C.muted,
    borderRadius: 1,
  },
  calendarPinLeft: {
    left: 6,
  },
  calendarPinRight: {
    right: 6,
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
