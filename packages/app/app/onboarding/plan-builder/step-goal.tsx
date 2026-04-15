import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { defaultPhases } from '@steady/types';
import type { PhaseConfig } from '@steady/types';
import { PhaseEditor } from '../../../components/plan-builder/PhaseEditor';
import { TripleWheelPicker } from '../../../components/plan-builder/TripleWheelPicker';
import { Btn } from '../../../components/ui/Btn';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { C } from '../../../constants/colours';
import { FONTS } from '../../../constants/typography';
import {
  RACE_TARGETS,
  raceDateForPlanStartingThisWeek,
  todayIsoLocal,
} from '../../../lib/plan-helpers';

const RACES = ['5K', '10K', 'Half Marathon', 'Marathon', 'Ultra'] as const;
const ULTRA_PRESETS = ['50K', '100K', '100M', 'Custom'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS = Array.from({ length: 30 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES_SECONDS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

type Race = (typeof RACES)[number];
type UltraPreset = (typeof ULTRA_PRESETS)[number];

function buildIsoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function formatShortDate(isoDate: string) {
  const { year, monthIndex, day } = parseIsoDate(isoDate);
  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

function weeksToRace(todayIso: string, raceDate: string) {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const race = new Date(`${raceDate}T00:00:00Z`);
  const diffDays = Math.ceil((race.getTime() - today.getTime()) / 86_400_000);
  return Math.max(4, Math.min(52, Math.ceil(Math.max(diffDays, 1) / 7)));
}

function raceLabelFor(race: Race, ultraPreset: UltraPreset, customUltraDistance: string) {
  if (race !== 'Ultra') return race;
  if (ultraPreset === 'Custom') {
    return `${customUltraDistance.trim() || 'Custom'} Ultra`;
  }
  return `${ultraPreset} Ultra`;
}

function defaultCustomTimeForRace(race: Race) {
  switch (race) {
    case '5K':
      return { hours: 0, minutes: 18, seconds: 0 };
    case '10K':
      return { hours: 0, minutes: 40, seconds: 0 };
    case 'Half Marathon':
      return { hours: 1, minutes: 30, seconds: 0 };
    case 'Ultra':
      return { hours: 13, minutes: 25, seconds: 0 };
    case 'Marathon':
    default:
      return { hours: 3, minutes: 15, seconds: 0 };
  }
}

function formatTargetTime(hours: number, minutes: number, seconds: number) {
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
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

export default function StepGoal() {
  const [todayIso] = useState(() => todayIsoLocal());
  const [race, setRace] = useState<Race>('Marathon');
  const [ultraPreset, setUltraPreset] = useState<UltraPreset>('100K');
  const [customUltraDistance, setCustomUltraDistance] = useState('');
  const [raceName, setRaceName] = useState('');
  const [raceDate, setRaceDate] = useState(() => raceDateForPlanStartingThisWeek(todayIso, 16));
  const [draftRaceDate, setDraftRaceDate] = useState(raceDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [target, setTarget] = useState('sub-3:15');
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [customTime, setCustomTime] = useState(() => defaultCustomTimeForRace('Marathon'));
  const [phases, setPhases] = useState<PhaseConfig>(() => defaultPhases(16));

  const years = Array.from({ length: 6 }, (_, index) => String(parseIsoDate(todayIso).year + index));
  const weeks = weeksToRace(todayIso, raceDate);
  const targets = RACE_TARGETS[race] || [];
  const allTargets = [...targets, 'Other'];
  const raceLabel = raceLabelFor(race, ultraPreset, customUltraDistance);
  const resolvedTargetTime = isCustomTarget
    ? formatTargetTime(customTime.hours, customTime.minutes, customTime.seconds)
    : target;

  const draftParts = parseIsoDate(draftRaceDate);
  const draftDayItems = Array.from(
    { length: daysInMonth(draftParts.year, draftParts.monthIndex) },
    (_, index) => String(index + 1).padStart(2, '0'),
  );
  const draftYearIndex = Math.max(0, years.findIndex((year) => Number(year) === draftParts.year));
  const draftMonthIndex = draftParts.monthIndex;
  const draftDayIndex = Math.max(0, draftParts.day - 1);

  useEffect(() => {
    setPhases(defaultPhases(weeks));
  }, [weeks]);

  const handleRaceChange = (nextRace: Race) => {
    setRace(nextRace);
    const nextTargets = RACE_TARGETS[nextRace] || [];
    setTarget(nextTargets[2] || nextTargets[0] || '');
    setIsCustomTarget(false);
    setCustomTime(defaultCustomTimeForRace(nextRace));
  };

  const handleTargetSelect = (value: string) => {
    if (value === 'Other') {
      setIsCustomTarget(true);
      setCustomTime(defaultCustomTimeForRace(race));
      return;
    }
    setIsCustomTarget(false);
    setTarget(value);
  };

  const updateDraftDate = (year: number, monthIndex: number, day: number) => {
    const boundedDay = Math.min(day, daysInMonth(year, monthIndex));
    setDraftRaceDate(buildIsoDate(year, monthIndex, boundedDay));
  };

  const handleNext = () => {
    const raceYear = parseIsoDate(raceDate).year;
    router.push({
      pathname: '/onboarding/plan-builder/step-template',
      params: {
        raceDistance: race,
        raceLabel,
        raceName: raceName.trim() || `${raceLabel} ${raceYear}`,
        raceDate,
        weeks: String(weeks),
        targetTime: resolvedTargetTime,
        phases: JSON.stringify(phases),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.step}>STEP 1 OF 3</Text>
        <Text style={styles.title}>What are you{'\n'}training for?</Text>

        <View style={styles.section}>
          <SectionLabel>Race distance</SectionLabel>
          <View style={styles.chipsGroup}>
            {RACES.map((option) => {
              const selected = race === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleRaceChange(option)}
                  style={[
                    styles.chip,
                    selected && styles.chipClaySelected,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipClayText]}>{option}</Text>
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
                <View style={styles.customDistanceRow}>
                  <TextInput
                    value={customUltraDistance}
                    onChangeText={setCustomUltraDistance}
                    placeholder="e.g. 80K or 70M"
                    placeholderTextColor={C.muted}
                    selectionColor={C.clay}
                    style={styles.customDistanceInput}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionLabel>Race name</SectionLabel>
          <View style={styles.inputBox}>
            <SearchIcon />
            <TextInput
              value={raceName}
              onChangeText={setRaceName}
              placeholder={
                race === 'Ultra' ? 'e.g. UTMB 2026, Leadville 100' : 'e.g. London Marathon 2026'
              }
              placeholderTextColor={C.muted}
              selectionColor={C.clay}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Race date</SectionLabel>
          <Pressable onPress={() => {
            setDraftRaceDate(raceDate);
            setShowDatePicker(true);
          }} style={styles.dateRow}>
            <View>
              <Text style={styles.dateValue}>{formatShortDate(raceDate)}</Text>
              <Text style={styles.dateHint}>Sets weeks to race automatically</Text>
            </View>
            <View style={styles.dateRight}>
              <View style={styles.weeksPill}>
                <Text style={styles.weeksPillText}>{weeks} wks</Text>
              </View>
              <CalendarIcon />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionLabel>Target time</SectionLabel>
          <View style={styles.chipsGroup}>
            {allTargets.map((option) => {
              const selected = option === 'Other' ? isCustomTarget : !isCustomTarget && target === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleTargetSelect(option)}
                  style={[styles.chip, selected && styles.chipAmberSelected]}
                >
                  <Text style={[styles.targetChipText, selected && styles.chipAmberText]}>{option}</Text>
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

        <View style={styles.section}>
          <SectionLabel>Phase breakdown</SectionLabel>
          <PhaseEditor phases={phases} totalWeeks={weeks} onChange={setPhases} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Btn title="Build my template week →" onPress={handleNext} fullWidth />
      </View>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDatePicker(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pick race date</Text>
            <Text style={styles.sheetSubtitle}>{formatShortDate(draftRaceDate)}</Text>
            <TripleWheelPicker
              columns={[
                {
                  items: draftDayItems,
                  label: 'day',
                  selectedIndex: draftDayIndex,
                  onSelect: (index) =>
                    updateDraftDate(draftParts.year, draftParts.monthIndex, index + 1),
                },
                {
                  items: MONTHS,
                  label: 'month',
                  selectedIndex: draftMonthIndex,
                  onSelect: (index) => updateDraftDate(draftParts.year, index, draftParts.day),
                },
                {
                  items: years,
                  label: 'year',
                  selectedIndex: draftYearIndex,
                  onSelect: (index) =>
                    updateDraftDate(Number(years[index]), draftParts.monthIndex, draftParts.day),
                },
              ]}
              activeColor={C.clay}
              borderColor={C.border}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setShowDatePicker(false)} style={styles.sheetSecondary}>
                <Text style={styles.sheetSecondaryText}>Cancel</Text>
              </Pressable>
              <View style={styles.sheetPrimary}>
                <Btn
                  title="Done"
                  onPress={() => {
                    setRaceDate(draftRaceDate);
                    setShowDatePicker(false);
                  }}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 56,
    paddingBottom: 120,
  },
  step: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.clay,
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
    lineHeight: 29,
    marginBottom: 22,
  },
  section: {
    marginBottom: 18,
  },
  chipsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipClaySelected: {
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  chipAmberSelected: {
    borderColor: C.amber,
    backgroundColor: C.amberBg,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink2,
  },
  chipClayText: {
    color: C.clay,
    fontFamily: FONTS.sansSemiBold,
  },
  chipAmberText: {
    color: C.amber,
    fontFamily: FONTS.monoBold,
  },
  targetChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: C.ink2,
  },
  ultraPanel: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(196,82,42,0.22)',
    backgroundColor: C.clayBg,
    padding: 12,
  },
  ultraPanelLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.clay,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  ultraChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  ultraChip: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(196,82,42,0.28)',
    backgroundColor: '#FFFFFF',
  },
  ultraChipSelected: {
    borderColor: C.clay,
    backgroundColor: C.clay,
  },
  ultraChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.ink2,
  },
  ultraChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: FONTS.sansSemiBold,
  },
  customDistanceRow: {
    marginTop: 10,
  },
  customDistanceInput: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(196,82,42,0.30)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink,
    padding: 0,
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
  dateRow: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
    marginBottom: 2,
  },
  dateHint: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  dateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weeksPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(196,82,42,0.20)',
    backgroundColor: C.clayBg,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  weeksPillText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.clay,
  },
  calendarIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.muted,
  },
  calendarTopLine: {
    position: 'absolute',
    left: -1.5,
    right: -1.5,
    top: 5.5,
    height: 1.5,
    backgroundColor: C.muted,
  },
  calendarPin: {
    position: 'absolute',
    top: -2,
    width: 1.5,
    height: 5,
    backgroundColor: C.muted,
    borderRadius: 1,
  },
  calendarPinLeft: {
    left: 4.5,
  },
  calendarPinRight: {
    right: 4.5,
  },
  timePickerWrap: {
    marginTop: 8,
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,21,16,0.60)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: C.cream,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.clay,
    marginBottom: 16,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  sheetSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
  },
  sheetSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  sheetPrimary: {
    flex: 1.2,
  },
});
