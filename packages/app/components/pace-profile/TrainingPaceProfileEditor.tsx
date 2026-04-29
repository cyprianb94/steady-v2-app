import React, { useEffect, useMemo, useState } from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import {
  deriveTrainingPaceProfile,
  getOrderedTrainingPaceProfileBands,
  normalizePaceRange,
  normalizeTrainingPaceProfile,
  trainingPaceBandToIntensityTarget,
  type PaceRange,
  type TrainingPaceProfile,
  type TrainingPaceProfileBand,
  type TrainingPaceProfileKey,
} from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { formatIntensityTargetDisplay } from '../../lib/units';

export const TRAINING_PACE_PROFILE_INTRO =
  'These are estimates only. Change them if recent training gives you a better number.';

const EDITABLE_KEYS: TrainingPaceProfileKey[] = [
  'recovery',
  'easy',
  'steady',
  'threshold',
  'interval',
];

const BAND_DESCRIPTIONS: Record<TrainingPaceProfileKey, string> = {
  recovery: 'Very easy running and warm-ups.',
  easy: 'Conversational running.',
  steady: 'Aerobic but purposeful.',
  marathon: 'Set by your race target.',
  threshold: 'Tempo and cruise interval work.',
  interval: 'Harder reps around 3K-5K effort.',
};

const BAND_COLORS: Record<TrainingPaceProfileKey, string> = {
  recovery: C.slate,
  easy: C.forest,
  steady: C.navy,
  marathon: C.metricPace,
  threshold: C.amber,
  interval: C.clay,
};

const COMPLETE_PACE_DRAFT = /^\s*\d{1,2}:[0-5]\d\s*(?:\/\s*(?:km|mi))?\s*$/i;

const INPUT_SCROLL_OFFSETS: Record<TrainingPaceProfileKey, number> = {
  recovery: 0,
  easy: 72,
  steady: 150,
  marathon: 0,
  threshold: 160,
  interval: 180,
};

type TrainingPaceProfileScrollable = {
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

export function scrollTrainingPaceProfileInputIntoView(
  scrollRef: { current: TrainingPaceProfileScrollable | null },
  profileKey: TrainingPaceProfileKey,
) {
  const y = INPUT_SCROLL_OFFSETS[profileKey] ?? 0;
  scrollRef.current?.scrollTo({ y, animated: true });
  setTimeout(() => {
    scrollRef.current?.scrollTo({ y, animated: true });
  }, 120);
}

function PaceRangeTextInput({
  useBottomSheetTextInput,
  ...props
}: TextInputProps & {
  useBottomSheetTextInput: boolean;
}) {
  return useBottomSheetTextInput
    ? <BottomSheetTextInput {...props} />
    : <TextInput {...props} />;
}

function cloneProfile(profile: TrainingPaceProfile): TrainingPaceProfile {
  return normalizeTrainingPaceProfile(profile) ?? profile;
}

function profileDerivedFromTarget(profile: TrainingPaceProfile): TrainingPaceProfile {
  return deriveTrainingPaceProfile({
    raceDistance: profile.raceDistance,
    targetTime: profile.targetTime,
  });
}

function formatBandTarget(band: TrainingPaceProfileBand): string {
  return formatIntensityTargetDisplay(trainingPaceBandToIntensityTarget(band), 'metric', {
    withUnit: true,
    includeEffort: false,
  }) ?? '—';
}

function bandRange(band: TrainingPaceProfileBand): PaceRange {
  if (band.paceRange) {
    return band.paceRange;
  }

  const pace = band.pace ?? '5:00';
  return { min: pace, max: pace };
}

function isEditedBand(
  band: TrainingPaceProfileBand,
  derivedBand: TrainingPaceProfileBand | undefined,
): boolean {
  if (!derivedBand) {
    return false;
  }

  return formatBandTarget(band) !== formatBandTarget(derivedBand);
}

function paceRangesEqual(a: PaceRange, b: PaceRange): boolean {
  return a.min === b.min && a.max === b.max;
}

function normalizeCompletePaceRange(min: string, max: string): PaceRange | undefined {
  if (!COMPLETE_PACE_DRAFT.test(min) || !COMPLETE_PACE_DRAFT.test(max)) {
    return undefined;
  }

  return normalizePaceRange({ min, max });
}

function racePaceLabel(profile: TrainingPaceProfile): string {
  return profile.raceDistance === 'Marathon' ? 'Marathon race pace' : 'Race pace';
}

export function racePaceAbbreviation(profile: TrainingPaceProfile): string {
  return racePaceLabel(profile);
}

export function trainingPaceProfileSummary(profile: TrainingPaceProfile): string {
  return `${EDITABLE_KEYS.length} training ranges · ${racePaceLabel(profile)} ${profile.racePace}/km`;
}

export function serializeTrainingPaceProfile(profile: TrainingPaceProfile): string {
  return JSON.stringify(cloneProfile(profile));
}

export function updateTrainingPaceProfileBandRange(
  profile: TrainingPaceProfile,
  profileKey: TrainingPaceProfileKey,
  paceRange: PaceRange,
): TrainingPaceProfile {
  const band = profile.bands[profileKey];
  if (!band?.editability.editable) {
    return profile;
  }

  const updated = {
    ...profile,
    bands: {
      ...profile.bands,
      [profileKey]: {
        ...band,
        paceRange,
        pace: undefined,
      },
    },
  };

  return normalizeTrainingPaceProfile(updated) ?? profile;
}

export function TrainingPaceProfileSummaryCard({
  profile,
  onAdjust,
}: {
  profile: TrainingPaceProfile;
  onAdjust: () => void;
}) {
  const orderedBands = useMemo(
    () => getOrderedTrainingPaceProfileBands(profile).filter((band) => (
      EDITABLE_KEYS.includes(band.profileKey)
    )),
    [profile],
  );

  return (
    <View style={styles.summaryCard} testID="pace-profile-summary-card">
      <View style={styles.summaryHead}>
        <View style={styles.summaryTitleGroup}>
          <Text style={styles.summaryKicker}>{racePaceLabel(profile)}</Text>
          <Text style={styles.summaryPace}>{profile.racePace}/km</Text>
        </View>
        <View style={styles.summaryMetaPill}>
          <Text style={styles.summaryMetaPillText}>Target</Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        {orderedBands.map((band) => (
          <View key={band.profileKey} style={styles.summaryBand}>
            <View style={[styles.bandDot, { backgroundColor: BAND_COLORS[band.profileKey] }]} />
            <View style={styles.summaryBandText}>
              <Text style={styles.summaryBandLabel}>{band.label}</Text>
              <Text style={styles.summaryBandValue}>{formatBandTarget(band)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        testID="pace-profile-adjust"
        accessibilityRole="button"
        onPress={onAdjust}
        style={({ pressed }) => [styles.adjustRow, pressed ? styles.pressed : null]}
      >
        <Text style={styles.adjustText}>Adjust paces</Text>
        <Text style={styles.adjustChevron}>›</Text>
      </Pressable>
    </View>
  );
}

function PaceProfileRangeRow({
  band,
  derivedBand,
  expanded,
  first,
  showEstimateStatus,
  useBottomSheetTextInput,
  onToggle,
  onApply,
  onResetEstimate,
  onInputFocus,
}: {
  band: TrainingPaceProfileBand;
  derivedBand: TrainingPaceProfileBand | undefined;
  expanded: boolean;
  first?: boolean;
  showEstimateStatus: boolean;
  useBottomSheetTextInput: boolean;
  onToggle: () => void;
  onApply: (range: PaceRange) => void;
  onResetEstimate: (range: PaceRange) => void;
  onInputFocus?: (profileKey: TrainingPaceProfileKey) => void;
}) {
  const currentRange = bandRange(band);
  const derivedRange = derivedBand ? bandRange(derivedBand) : null;
  const [minDraft, setMinDraft] = useState(currentRange.min);
  const [maxDraft, setMaxDraft] = useState(currentRange.max);
  const [error, setError] = useState<string | null>(null);
  const edited = isEditedBand(band, derivedBand);

  useEffect(() => {
    setMinDraft(currentRange.min);
    setMaxDraft(currentRange.max);
    setError(null);
  }, [currentRange.min, currentRange.max]);

  function stageCompleteDraft(nextMin: string, nextMax: string) {
    const normalized = normalizeCompletePaceRange(nextMin, nextMax);
    if (!normalized) {
      setError(null);
      return;
    }

    setError(null);
    if (!paceRangesEqual(normalized, currentRange)) {
      onApply(normalized);
    }
  }

  function settleDraft() {
    const normalized = normalizePaceRange({ min: minDraft, max: maxDraft });
    if (!normalized) {
      setError('Use pace format like 4:20.');
      return;
    }

    setError(null);
    setMinDraft(normalized.min);
    setMaxDraft(normalized.max);
    if (!paceRangesEqual(normalized, currentRange)) {
      onApply(normalized);
    }
  }

  function changeMinDraft(value: string) {
    setMinDraft(value);
    stageCompleteDraft(value, maxDraft);
  }

  function changeMaxDraft(value: string) {
    setMaxDraft(value);
    stageCompleteDraft(minDraft, value);
  }

  function resetEstimate() {
    if (!derivedRange) {
      return;
    }

    setMinDraft(derivedRange.min);
    setMaxDraft(derivedRange.max);
    setError(null);
    onResetEstimate(derivedRange);
  }

  return (
    <View style={[styles.bandRowWrap, first ? styles.bandRowWrapFirst : null]}>
      <Pressable
        testID={`pace-profile-row-${band.profileKey}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.bandRow, pressed ? styles.pressed : null]}
      >
        <View style={styles.bandLabelGroup}>
          <View style={styles.bandLabelLine}>
            <View style={[styles.bandDot, { backgroundColor: BAND_COLORS[band.profileKey] }]} />
            <Text style={styles.bandLabel}>{band.label} range</Text>
          </View>
          <Text style={styles.bandDescription}>{BAND_DESCRIPTIONS[band.profileKey]}</Text>
        </View>
        <View style={styles.bandValueGroup}>
          <Text style={styles.bandValue}>{formatBandTarget(band)}</Text>
          {showEstimateStatus ? (
            <Text style={[styles.bandMeta, edited ? styles.bandMetaEdited : null]}>
              {edited ? 'Edited' : 'Estimated'}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.rangeEditor}>
          <View style={styles.rangeInputs}>
            <View style={styles.rangeInputWrap}>
              <Text style={styles.rangeInputLabel}>Faster end</Text>
              <PaceRangeTextInput
                testID={`pace-profile-input-${band.profileKey}-min`}
                value={minDraft}
                onChangeText={changeMinDraft}
                onFocus={() => onInputFocus?.(band.profileKey)}
                onBlur={settleDraft}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                style={styles.rangeInput}
                useBottomSheetTextInput={useBottomSheetTextInput}
              />
            </View>
            <View style={styles.rangeInputWrap}>
              <Text style={styles.rangeInputLabel}>Slower end</Text>
              <PaceRangeTextInput
                testID={`pace-profile-input-${band.profileKey}-max`}
                value={maxDraft}
                onChangeText={changeMaxDraft}
                onFocus={() => onInputFocus?.(band.profileKey)}
                onBlur={settleDraft}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                style={styles.rangeInput}
                useBottomSheetTextInput={useBottomSheetTextInput}
              />
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {showEstimateStatus && edited && derivedRange ? (
            <Pressable
              testID={`pace-profile-reset-${band.profileKey}`}
              accessibilityRole="button"
              onPress={resetEstimate}
              style={({ pressed }) => [styles.resetEstimateButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.resetEstimateText}>Reset estimate</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TrainingPaceProfileEditor({
  profile,
  onChange,
  title,
  intro = TRAINING_PACE_PROFILE_INTRO,
  showEstimateStatus = true,
  useBottomSheetTextInput = false,
  onInputFocus,
}: {
  profile: TrainingPaceProfile;
  onChange: (profile: TrainingPaceProfile) => void;
  title?: string;
  intro?: string;
  showEstimateStatus?: boolean;
  useBottomSheetTextInput?: boolean;
  onInputFocus?: (profileKey: TrainingPaceProfileKey) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<TrainingPaceProfileKey | null>(null);
  const orderedBands = useMemo(() => getOrderedTrainingPaceProfileBands(profile), [profile]);
  const derivedBands = useMemo(
    () => profileDerivedFromTarget(profile).bands,
    [profile.raceDistance, profile.targetTime],
  );
  const lockedBand = orderedBands.find((band) => !band.editability.editable);
  const editableBands = orderedBands.filter((band) => EDITABLE_KEYS.includes(band.profileKey));

  function applyBandRange(profileKey: TrainingPaceProfileKey, paceRange: PaceRange) {
    onChange(updateTrainingPaceProfileBandRange(profile, profileKey, paceRange));
  }

  return (
    <View style={styles.editor} testID="pace-profile-editor">
      {title ? <Text style={styles.editorTitle}>{title}</Text> : null}
      {intro ? <Text style={styles.editorIntro}>{intro}</Text> : null}

      {lockedBand ? (
        <View style={styles.lockedCard}>
          <View style={styles.lockedHeader}>
            <Text style={styles.lockedKicker}>{racePaceLabel(profile)}</Text>
            <Text style={styles.lockedPace}>{formatBandTarget(lockedBand)}</Text>
          </View>
          <Text style={styles.lockedCopy}>Locked from your target.</Text>
        </View>
      ) : null}

      <View style={styles.bandList}>
        {editableBands.map((band, index) => (
          <PaceProfileRangeRow
            key={band.profileKey}
            band={band}
            derivedBand={derivedBands[band.profileKey]}
            expanded={expandedKey === band.profileKey}
            first={index === 0}
            showEstimateStatus={showEstimateStatus}
            useBottomSheetTextInput={useBottomSheetTextInput}
            onToggle={() => setExpandedKey((current) => (
              current === band.profileKey ? null : band.profileKey
            ))}
            onApply={(range) => applyBandRange(band.profileKey, range)}
            onResetEstimate={(range) => applyBandRange(band.profileKey, range)}
            onInputFocus={onInputFocus}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    paddingBottom: 12,
  },
  summaryTitleGroup: {
    flex: 1,
    gap: 3,
  },
  summaryKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    color: C.muted,
  },
  summaryPace: {
    fontFamily: FONTS.monoBold,
    fontSize: 24,
    lineHeight: 29,
    color: C.metricPace,
  },
  summaryMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.metricPaceBg,
    borderColor: `${C.metricPace}33`,
    borderWidth: 1,
  },
  summaryMetaPillText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.metricPace,
  },
  summaryGrid: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 9,
  },
  summaryBand: {
    width: '50%',
    minWidth: 128,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  bandDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 5,
  },
  summaryBandText: {
    flex: 1,
    gap: 1,
  },
  summaryBandLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: C.ink,
  },
  summaryBandValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 15,
    color: C.ink2,
  },
  adjustRow: {
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  adjustText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: C.clay,
  },
  adjustChevron: {
    width: 20,
    textAlign: 'center',
    fontFamily: FONTS.sansMedium,
    fontSize: 20,
    lineHeight: 20,
    color: C.muted,
  },
  editor: {
    gap: 12,
  },
  editorTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 25,
    lineHeight: 30,
    color: C.ink,
  },
  editorIntro: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
  },
  lockedCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${C.metricPace}25`,
    backgroundColor: C.metricPaceBg,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lockedKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    color: C.metricPace,
  },
  lockedPace: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    lineHeight: 24,
    color: C.metricPace,
  },
  lockedCopy: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.metricPace,
  },
  bandList: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  bandRowWrap: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bandRowWrapFirst: {
    borderTopWidth: 0,
  },
  bandRow: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bandLabelGroup: {
    flex: 1,
    gap: 3,
  },
  bandLabelLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bandLabel: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
  },
  bandDescription: {
    marginLeft: 15,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.muted,
  },
  bandValueGroup: {
    alignItems: 'flex-end',
    gap: 2,
  },
  bandValue: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 16,
    color: C.ink2,
  },
  bandMeta: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    lineHeight: 12,
    color: C.muted,
  },
  bandMetaEdited: {
    color: C.forest,
    fontFamily: FONTS.sansSemiBold,
  },
  rangeEditor: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  rangeInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeInputWrap: {
    flex: 1,
    gap: 5,
  },
  rangeInputLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    lineHeight: 12,
    color: C.muted,
  },
  rangeInput: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.cream,
    paddingHorizontal: 12,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  errorText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.clay,
  },
  resetEstimateButton: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  resetEstimateText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 15,
    color: C.clay,
  },
  pressed: {
    opacity: 0.82,
  },
});
