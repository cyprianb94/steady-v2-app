import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  normalizeSessionDuration,
  sessionSupportsWarmupCooldown,
  type IntervalRecovery,
  type PlannedSession,
  type RecoveryDuration,
  type SessionDurationUnit,
  type SessionType,
} from '@steady/types';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { Btn } from '../ui/Btn';
import { ChipRow } from '../ui/ChipRow';
import { ChipStripEditor } from '../ui/ChipStripEditor';
import { EditableChipStrip } from '../ui/EditableChipStrip';
import { NotebookRow } from '../ui/NotebookRow';
import { NotebookRowValue } from '../ui/NotebookRowValue';
import { RepStepper } from '../ui/RepStepper';
import { SectionLabel } from '../ui/SectionLabel';
import { UnitTogglePill } from '../ui/UnitTogglePill';
import { GorhomSheet } from '../ui/GorhomSheet';
import { DAYS, TYPE_DEFAULTS, sessionLabel } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';

interface SessionEditorProps {
  dayIndex: number;
  existing: Partial<PlannedSession> | null;
  onSave: (dayIndex: number, session: Partial<PlannedSession> | null) => void;
  onClose: () => void;
  presentation?: 'sheet' | 'screen';
}

type ExpandedRow = 'distance' | 'repetitions' | 'pace' | 'recovery' | 'warmup' | 'cooldown' | null;
type CustomField = Exclude<ExpandedRow, null> | null;

interface DurationState {
  unit: SessionDurationUnit;
  value: number | null;
}

const DISTANCE_PRESETS = [5, 8, 10, 12, 15];
const LONG_DISTANCE_PRESETS = [12, 15, 18, 20, 22];
const REP_DURATION_KM_PRESETS = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6];
const REP_DURATION_MIN_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10];
const RECOVERY_KM_PRESETS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.8, 1];
const RECOVERY_MIN_PRESETS = [0.75, 1, 1.5, 2, 3, 4, 5];
const WARMUP_KM_PRESETS = [0, 1, 1.5, 2, 3];
const WARMUP_MIN_PRESETS = [5, 10, 15, 20];
const COOLDOWN_KM_PRESETS = [0, 0.5, 1, 1.5, 2];
const COOLDOWN_MIN_PRESETS = [5, 10, 15];
const SESSION_TYPES: SessionType[] = ['EASY', 'INTERVAL', 'TEMPO', 'LONG', 'REST'];
const PACE_PRESET_OFFSETS = [-15, -10, -5, 0, 5, 10, 15];
const MIN_TARGET_PACE_SECONDS = 150;
const MAX_TARGET_PACE_SECONDS = 720;
const LEGACY_RECOVERY_MINUTES: Record<RecoveryDuration, number> = {
  '45s': 0.75,
  '60s': 1,
  '90s': 1.5,
  '2min': 2,
  '3min': 3,
  '4min': 4,
  '5min': 5,
};

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function typeChipLabel(type: SessionType): string {
  switch (type) {
    case 'INTERVAL':
      return 'Interval';
    case 'LONG':
      return 'Long';
    case 'REST':
      return 'Rest';
    case 'TEMPO':
      return 'Tempo';
    case 'EASY':
    default:
      return 'Easy';
  }
}

function targetPaceCaption(type: SessionType): string {
  switch (type) {
    case 'INTERVAL':
      return 'Per rep';
    case 'LONG':
      return 'Long effort';
    case 'TEMPO':
      return 'Tempo effort';
    case 'EASY':
    default:
      return 'Easy effort';
  }
}

function buildDurationState(value: Partial<PlannedSession>['warmup']): DurationState {
  const normalized = normalizeSessionDuration(value);
  return {
    unit: normalized?.unit ?? 'km',
    value: normalized?.value ?? null,
  };
}

function buildRepDurationState(session: Partial<PlannedSession> | null): DurationState {
  const normalized = normalizeSessionDuration(session?.repDuration);
  if (normalized) {
    return normalized;
  }

  return {
    unit: 'km',
    value: session?.repDist ? session.repDist / 1000 : 0.8,
  };
}

function buildRecoveryState(value: IntervalRecovery | null | undefined): DurationState {
  if (typeof value === 'string') {
    return { unit: 'min', value: LEGACY_RECOVERY_MINUTES[value] ?? 1.5 };
  }

  const normalized = normalizeSessionDuration(value);
  return {
    unit: normalized?.unit ?? 'min',
    value: normalized?.value ?? 1.5,
  };
}

function durationPresets(field: 'warmup' | 'cooldown', unit: SessionDurationUnit): number[] {
  if (field === 'warmup') {
    return unit === 'km' ? WARMUP_KM_PRESETS : WARMUP_MIN_PRESETS;
  }

  return unit === 'km' ? COOLDOWN_KM_PRESETS : COOLDOWN_MIN_PRESETS;
}

function repDurationPresets(unit: SessionDurationUnit): number[] {
  return unit === 'km' ? REP_DURATION_KM_PRESETS : REP_DURATION_MIN_PRESETS;
}

function recoveryPresets(unit: SessionDurationUnit): number[] {
  return unit === 'km' ? RECOVERY_KM_PRESETS : RECOVERY_MIN_PRESETS;
}

function distancePresets(type: SessionType): number[] {
  return type === 'LONG' ? LONG_DISTANCE_PRESETS : DISTANCE_PRESETS;
}

function formatRepLength(state: DurationState): string {
  if (state.value == null) {
    return '—';
  }

  if (state.unit === 'km') {
    const metres = state.value * 1000;
    return Number.isInteger(metres) && metres < 1000
      ? `${metres}m`
      : `${formatValue(state.value)} km`;
  }

  return `${formatValue(state.value)} min`;
}

function paceToSeconds(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function secondsToPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeCustomPace(text: string): string | null {
  const cleaned = text.trim().replace(/\s*\/\s*km$/i, '');
  const match = cleaned.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return null;
  }

  const total = minutes * 60 + seconds;
  return total > 0 ? secondsToPace(total) : null;
}

function pacePresets(currentPace: string, type: SessionType): string[] {
  const fallbackSeconds = paceToSeconds(TYPE_DEFAULTS[type].pace) ?? 270;
  const baseSeconds = paceToSeconds(currentPace) ?? fallbackSeconds;
  const presets = PACE_PRESET_OFFSETS
    .map((offset) => baseSeconds + offset)
    .filter((seconds) => seconds >= MIN_TARGET_PACE_SECONDS && seconds <= MAX_TARGET_PACE_SECONDS)
    .map(secondsToPace);

  return Array.from(new Set(presets));
}

function parseCustomValue(text: string, allowDecimal: boolean): number | null {
  const normalized = text.replace(',', '.').trim();
  if (!normalized) {
    return null;
  }

  const parsed = allowDecimal ? Number(normalized) : Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return allowDecimal ? parsed : Math.trunc(parsed);
}

function durationSpec(state: DurationState) {
  return state.value != null && state.value > 0
    ? { unit: state.unit, value: state.value }
    : undefined;
}

function afterNextPaint(callback: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }

  setTimeout(callback, 0);
}

export function SessionEditor({
  dayIndex,
  existing,
  onSave,
  onClose,
  presentation = 'sheet',
}: SessionEditorProps) {
  const { units } = usePreferences();
  const scrollRef = useRef<ScrollView>(null);
  const init = existing?.type || 'EASY';
  const [type, setType] = useState<SessionType>(init);
  const [distance, setDistance] = useState(existing?.distance ?? 8);
  const [reps, setReps] = useState(existing?.reps || 6);
  const [repDist, setRepDist] = useState(existing?.repDist || 800);
  const [repDuration, setRepDuration] = useState<DurationState>(() => buildRepDurationState(existing));
  const [pace, setPace] = useState(existing?.pace || TYPE_DEFAULTS[init].pace || '4:30');
  const [recovery, setRecovery] = useState<DurationState>(() => buildRecoveryState(existing?.recovery));
  const [warmup, setWarmup] = useState<DurationState>(() => buildDurationState(existing?.warmup));
  const [cooldown, setCooldown] = useState<DurationState>(() => buildDurationState(existing?.cooldown));
  const [expandedRow, setExpandedRow] = useState<ExpandedRow>(null);
  const [customField, setCustomField] = useState<CustomField>(null);
  const [customDistance, setCustomDistance] = useState('');
  const [customRepDuration, setCustomRepDuration] = useState('');
  const [customRecovery, setCustomRecovery] = useState('');
  const [customPace, setCustomPace] = useState('');
  const [customPaceSelected, setCustomPaceSelected] = useState(false);
  const [customWarmup, setCustomWarmup] = useState('');
  const [customCooldown, setCustomCooldown] = useState('');

  const isInterval = type === 'INTERVAL';
  const isRest = type === 'REST';
  const supportsWarmupCooldown = sessionSupportsWarmupCooldown(type);
  const canEditPace = !isRest;
  const typeMeta = SESSION_TYPE[type];
  const pacePresetValues = pacePresets(pace, type);
  const visiblePacePresets = customPaceSelected
    ? pacePresetValues.filter((preset) => preset !== pace)
    : pacePresetValues;

  const build = (): Partial<PlannedSession> | null => {
    if (isRest) {
      return { type: 'REST' };
    }

    const session: Partial<PlannedSession> = {
      type,
      pace,
    };

    if (supportsWarmupCooldown) {
      const warmupSpec = durationSpec(warmup);
      const cooldownSpec = durationSpec(cooldown);

      if (warmupSpec) {
        session.warmup = warmupSpec;
      }

      if (cooldownSpec) {
        session.cooldown = cooldownSpec;
      }
    }

    if (isInterval) {
      const repDurationSpec = durationSpec(repDuration);
      const recoverySpec = durationSpec(recovery);
      const intervalFields: Partial<PlannedSession> = {
        reps,
        repDuration: repDurationSpec,
        recovery: recoverySpec,
      };

      if (repDuration.unit === 'km' && repDuration.value != null) {
        intervalFields.repDist = Math.round(repDuration.value * 1000);
      } else if (!repDurationSpec) {
        intervalFields.repDist = repDist;
      }

      Object.assign(session, intervalFields);
    } else {
      Object.assign(session, { distance });
    }

    return session;
  };

  function changeType(nextType: SessionType) {
    if (nextType === type) {
      return;
    }

    const defaults = TYPE_DEFAULTS[nextType];
    const defaultWarmup = normalizeSessionDuration(defaults.warmup);
    const defaultCooldown = normalizeSessionDuration(defaults.cooldown);

    setType(nextType);
    setPace(defaults.pace ?? pace);
    setExpandedRow(null);
    setCustomField(null);
    setCustomPaceSelected(false);

    if (nextType === 'INTERVAL') {
      setReps(defaults.reps ?? 6);
      setRepDist(defaults.repDist ?? 800);
      setRepDuration(buildRepDurationState(defaults));
      setRecovery(buildRecoveryState(defaults.recovery));
    } else if (nextType !== 'REST') {
      setDistance(defaults.distance ?? distance);
    }

    if (!sessionSupportsWarmupCooldown(nextType)) {
      setWarmup((current) => ({ ...current, value: null }));
      setCooldown((current) => ({ ...current, value: null }));
      return;
    }

    if (warmup.value == null && defaultWarmup) {
      setWarmup({ unit: defaultWarmup.unit, value: defaultWarmup.value });
    }

    if (cooldown.value == null && defaultCooldown) {
      setCooldown({ unit: defaultCooldown.unit, value: defaultCooldown.value });
    }
  }

  function toggleRow(row: Exclude<ExpandedRow, null>) {
    setExpandedRow((current) => (current === row ? null : row));
    setCustomField(null);
  }

  function setDurationValue(field: 'warmup' | 'cooldown', value: number | null) {
    if (field === 'warmup') {
      setWarmup((current) => ({ ...current, value }));
      return;
    }

    setCooldown((current) => ({ ...current, value }));
  }

  function setRepDurationValue(value: number | null) {
    setRepDuration((current) => ({ ...current, value }));
    if (repDuration.unit === 'km' && value != null) {
      setRepDist(Math.round(value * 1000));
    }
  }

  function setRecoveryValue(value: number | null) {
    setRecovery((current) => ({ ...current, value }));
  }

  function setRepDurationUnit(unit: SessionDurationUnit) {
    setRepDuration({ unit, value: unit === 'km' ? repDist / 1000 : null });
    setExpandedRow('repetitions');
    setCustomField(null);
  }

  function setRecoveryUnit(unit: SessionDurationUnit) {
    setRecovery({ unit, value: null });
    setExpandedRow('recovery');
    setCustomField(null);
  }

  function setDurationUnit(field: 'warmup' | 'cooldown', unit: SessionDurationUnit) {
    if (field === 'warmup') {
      setWarmup({ unit, value: null });
    } else {
      setCooldown({ unit, value: null });
    }

    setExpandedRow(field);
    setCustomField(null);
  }

  function keepCustomFieldVisible(field: Exclude<CustomField, null>) {
    const scrollTargets: Record<Exclude<CustomField, null>, number> = {
      distance: 80,
      repetitions: 80,
      pace: 120,
      recovery: 180,
      warmup: 280,
      cooldown: 340,
    };
    const y = scrollTargets[field];
    scrollRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
  }

  function clearCustomDraft(field: Exclude<CustomField, null>) {
    switch (field) {
      case 'distance':
        setCustomDistance('');
        return;
      case 'repetitions':
        setCustomRepDuration('');
        return;
      case 'pace':
        setCustomPace('');
        return;
      case 'recovery':
        setCustomRecovery('');
        return;
      case 'warmup':
        setCustomWarmup('');
        return;
      case 'cooldown':
        setCustomCooldown('');
        return;
    }
  }

  const customKeyboardPaddingStyle = customField
    ? !isInterval && (customField === 'warmup' || customField === 'cooldown')
      ? styles.bodyContentWithNonIntervalDurationKeyboard
      : styles.bodyContentWithCompactKeyboard
    : null;

  function openCustomField(field: Exclude<CustomField, null>) {
    clearCustomDraft(field);
    setCustomField(field);
    afterNextPaint(() => keepCustomFieldVisible(field));
  }

  function closeCustomField(field: Exclude<CustomField, null>) {
    setCustomField((current) => (current === field ? null : current));
  }

  function handleCustomNumberChange(
    field: Exclude<CustomField, 'pace' | null>,
    text: string,
  ) {
    if (field === 'distance') {
      setCustomDistance(text);
      const parsed = parseCustomValue(text, true);
      if (parsed != null) {
        setDistance(parsed);
      }
      return;
    }

    if (field === 'repetitions') {
      setCustomRepDuration(text);
      const parsed = parseCustomValue(text, true);
      if (parsed != null) {
        setRepDurationValue(parsed === 0 ? null : parsed);
      }
      return;
    }

    if (field === 'recovery') {
      setCustomRecovery(text);
      const parsed = parseCustomValue(text, true);
      if (parsed != null) {
        setRecoveryValue(parsed === 0 ? null : parsed);
      }
      return;
    }

    const duration = field === 'warmup' ? warmup : cooldown;
    const allowDecimal = duration.unit === 'km';
    if (field === 'warmup') {
      setCustomWarmup(text);
    } else {
      setCustomCooldown(text);
    }

    const parsed = parseCustomValue(text, allowDecimal);
    if (parsed != null) {
      setDurationValue(field, parsed === 0 ? null : parsed);
    }
  }

  const content = (
    <View style={presentation === 'screen' ? styles.screen : styles.sheet}>
      <View style={[styles.header, presentation === 'screen' && styles.screenHeader]}>
        {presentation === 'screen' ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Text style={styles.headerDay}>{DAYS[dayIndex]}</Text>
        <Text style={[styles.headerTitle, { color: typeMeta.color }]}>
          {isRest ? 'Rest day' : sessionLabel({ type, distance, reps, repDist, repDuration: durationSpec(repDuration), pace }, units)}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          customKeyboardPaddingStyle,
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <SectionLabel>Session type</SectionLabel>
          <ChipRow
            chips={SESSION_TYPES.map((sessionType) => ({
              key: sessionType,
              label: typeChipLabel(sessionType),
              color: SESSION_TYPE[sessionType].color,
            }))}
            selected={type}
            onSelect={(nextType) => changeType(nextType as SessionType)}
          />
        </View>

        <View style={styles.stack}>
              {isInterval ? (
                <NotebookRow
                  first
                  label="Repetitions"
                  trailing={(
                    <UnitTogglePill
                      value={repDuration.unit}
                      onChange={setRepDurationUnit}
                      disabled={isRest}
                    />
                  )}
                  onTap={() => toggleRow('repetitions')}
                  expanded={expandedRow === 'repetitions'}
                  editor={
                    expandedRow === 'repetitions' ? (
                      <View style={styles.editorBlock}>
                        <View style={styles.repsRow}>
                          <RepStepper value={reps} min={2} max={20} onChange={setReps} />
                          <Text style={styles.repsLabel}>reps</Text>
                        </View>
                        <ChipStripEditor
                          presets={repDurationPresets(repDuration.unit)}
                          unit={repDuration.unit}
                          value={repDuration.value}
                          onSelect={(value) => {
                            setRepDurationValue(value === 0 ? null : value);
                            closeCustomField('repetitions');
                          }}
                          customEditing={customField === 'repetitions'}
                          customValue={customRepDuration}
                          onCustomPress={() => {
                            openCustomField('repetitions');
                          }}
                          onCustomChangeText={(text) => handleCustomNumberChange('repetitions', text)}
                          onCustomBlur={() => closeCustomField('repetitions')}
                          onCustomFocus={() => keepCustomFieldVisible('repetitions')}
                        />
                      </View>
                    ) : undefined
                  }
                >
                  <View style={styles.rowCopy}>
                    <NotebookRowValue value={`${reps}×${formatRepLength(repDuration)}`} />
                    <Text style={styles.rowCaption}>Main set</Text>
                  </View>
                </NotebookRow>
              ) : (
                <NotebookRow
                  first
                  label="Distance"
                  onTap={!isRest ? () => toggleRow('distance') : undefined}
                  expanded={expandedRow === 'distance'}
                  editor={
                    expandedRow === 'distance' && !isRest ? (
                      <View style={styles.editorBlock}>
                        <ChipStripEditor
                          presets={distancePresets(type)}
                          unit="km"
                          value={distance}
                          onSelect={(value) => {
                            setDistance(value);
                            closeCustomField('distance');
                          }}
                          customEditing={customField === 'distance'}
                          customValue={customDistance}
                          onCustomPress={() => {
                            openCustomField('distance');
                          }}
                          onCustomChangeText={(text) => handleCustomNumberChange('distance', text)}
                          onCustomBlur={() => closeCustomField('distance')}
                          onCustomFocus={() => keepCustomFieldVisible('distance')}
                        />
                      </View>
                    ) : undefined
                  }
                >
                  {isRest ? (
                    <NotebookRowValue value="—" muted />
                  ) : (
                    <NotebookRowValue value={formatValue(distance)} unit="km" />
                  )}
                </NotebookRow>
              )}

              <NotebookRow
                label={isInterval ? 'Rep target pace' : 'Target pace'}
                onTap={canEditPace ? () => toggleRow('pace') : undefined}
                expanded={expandedRow === 'pace'}
                disabled={isRest}
                editor={
                  expandedRow === 'pace' && canEditPace ? (
                    <View style={styles.editorBlock}>
                      <EditableChipStrip
                        options={visiblePacePresets.map((preset) => ({
                          key: preset,
                          label: `${preset} /km`,
                        }))}
                        selectedKey={customPaceSelected ? null : pace}
                        activeColor={typeMeta.color}
                        customActive={customPaceSelected}
                        customEditing={customField === 'pace'}
                        customLabel={customPaceSelected ? `${pace} /km` : 'Custom...'}
                        customValue={customPace}
                        customUnit="/km"
                        customKeyboardType="numbers-and-punctuation"
                        onSelect={(value) => {
                          setPace(value);
                          setCustomPace('');
                          setCustomPaceSelected(false);
                          closeCustomField('pace');
                        }}
                        onCustomPress={() => {
                          openCustomField('pace');
                        }}
                        onCustomChangeText={(text) => {
                          setCustomPace(text);
                          const normalized = normalizeCustomPace(text);
                          if (normalized) {
                            setPace(normalized);
                            setCustomPaceSelected(true);
                          }
                        }}
                        onCustomBlur={() => closeCustomField('pace')}
                        onCustomFocus={() => keepCustomFieldVisible('pace')}
                      />
                    </View>
                  ) : undefined
                }
              >
                {isRest ? (
                  <NotebookRowValue value="—" muted />
                ) : (
                  <View style={styles.rowCopy}>
                    <NotebookRowValue value={pace || '—'} unit="/km" />
                    {canEditPace ? (
                      <Text style={styles.rowCaption}>{targetPaceCaption(type)}</Text>
                    ) : null}
                  </View>
                )}
              </NotebookRow>

              {isInterval ? (
                <NotebookRow
                  label="Recovery between reps"
                  trailing={(
                    <UnitTogglePill
                      value={recovery.unit}
                      onChange={setRecoveryUnit}
                      disabled={isRest}
                    />
                  )}
                  onTap={() => toggleRow('recovery')}
                  expanded={expandedRow === 'recovery'}
                  editor={
                    expandedRow === 'recovery' ? (
                      <View style={styles.editorBlock}>
                        <ChipStripEditor
                          presets={recoveryPresets(recovery.unit)}
                          unit={recovery.unit}
                          value={recovery.value}
                          onSelect={(value) => {
                            setRecoveryValue(value === 0 ? null : value);
                            closeCustomField('recovery');
                          }}
                          customEditing={customField === 'recovery'}
                          customValue={customRecovery}
                          onCustomPress={() => {
                            openCustomField('recovery');
                          }}
                          onCustomChangeText={(text) => handleCustomNumberChange('recovery', text)}
                          onCustomBlur={() => closeCustomField('recovery')}
                          onCustomFocus={() => keepCustomFieldVisible('recovery')}
                        />
                      </View>
                    ) : undefined
                  }
                >
                  {recovery.value != null ? (
                    <View style={styles.rowCopy}>
                      <NotebookRowValue value={formatValue(recovery.value)} unit={recovery.unit} />
                      <Text style={styles.rowCaption}>Between reps</Text>
                    </View>
                  ) : (
                    <Text style={styles.rowPrompt}>Tap to set</Text>
                  )}
                </NotebookRow>
              ) : null}

              {supportsWarmupCooldown ? (
                <>
                  <NotebookRow
                    label="Warm-up"
                    trailing={(
                      <UnitTogglePill
                        value={warmup.unit}
                        onChange={(unit) => setDurationUnit('warmup', unit)}
                      />
                    )}
                    onTap={() => toggleRow('warmup')}
                    expanded={expandedRow === 'warmup'}
                    editor={
                      expandedRow === 'warmup' ? (
                        <View style={styles.editorBlock}>
                          <ChipStripEditor
                            presets={durationPresets('warmup', warmup.unit)}
                            unit={warmup.unit}
                            value={warmup.value}
                            onSelect={(value) => {
                              setDurationValue('warmup', value === 0 ? null : value);
                              closeCustomField('warmup');
                            }}
                            customEditing={customField === 'warmup'}
                            customValue={customWarmup}
                            onCustomPress={() => {
                              openCustomField('warmup');
                            }}
                            onCustomChangeText={(text) => handleCustomNumberChange('warmup', text)}
                            onCustomBlur={() => closeCustomField('warmup')}
                            onCustomFocus={() => keepCustomFieldVisible('warmup')}
                          />
                        </View>
                      ) : undefined
                    }
                  >
                    {warmup.value != null ? (
                      <View style={styles.rowCopy}>
                        <NotebookRowValue value={formatValue(warmup.value)} unit={warmup.unit} />
                        <Text style={styles.rowCaption}>Easy</Text>
                      </View>
                    ) : (
                      <Text style={styles.rowPrompt}>Tap to set</Text>
                    )}
                  </NotebookRow>

                  <NotebookRow
                    label="Cool-down"
                    trailing={(
                      <UnitTogglePill
                        value={cooldown.unit}
                        onChange={(unit) => setDurationUnit('cooldown', unit)}
                      />
                    )}
                    onTap={() => toggleRow('cooldown')}
                    expanded={expandedRow === 'cooldown'}
                    editor={
                      expandedRow === 'cooldown' ? (
                        <View style={styles.editorBlock}>
                          <ChipStripEditor
                            presets={durationPresets('cooldown', cooldown.unit)}
                            unit={cooldown.unit}
                            value={cooldown.value}
                            onSelect={(value) => {
                              setDurationValue('cooldown', value === 0 ? null : value);
                              closeCustomField('cooldown');
                            }}
                            customEditing={customField === 'cooldown'}
                            customValue={customCooldown}
                            onCustomPress={() => {
                              openCustomField('cooldown');
                            }}
                            onCustomChangeText={(text) => handleCustomNumberChange('cooldown', text)}
                            onCustomBlur={() => closeCustomField('cooldown')}
                            onCustomFocus={() => keepCustomFieldVisible('cooldown')}
                          />
                        </View>
                      ) : undefined
                    }
                  >
                    {cooldown.value != null ? (
                      <View style={styles.rowCopy}>
                        <NotebookRowValue value={formatValue(cooldown.value)} unit={cooldown.unit} />
                        <Text style={styles.rowCaption}>Easy</Text>
                      </View>
                    ) : (
                      <Text style={styles.rowPrompt}>Tap to set</Text>
                    )}
                  </NotebookRow>
                </>
              ) : null}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <View style={styles.primaryAction}>
            <Btn
              title={existing ? 'Update session' : 'Add session'}
              onPress={() => onSave(dayIndex, build())}
              fullWidth
            />
          </View>
        </View>
      </View>
    </View>
  );

  if (presentation === 'screen') {
    return (
      <KeyboardAvoidingView
        testID="session-editor-keyboard-frame"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screenKeyboardFrame}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return (
    <GorhomSheet open onDismiss={onClose} backgroundColor={C.surface}>
      <KeyboardAvoidingView
        testID="session-editor-keyboard-frame"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetKeyboardFrame}
      >
        {content}
      </KeyboardAvoidingView>
    </GorhomSheet>
  );
}

const styles = StyleSheet.create({
  sheetKeyboardFrame: {
    width: '100%',
  },
  screenKeyboardFrame: {
    flex: 1,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%',
  },
  screen: {
    flex: 1,
    backgroundColor: C.surface,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  screenHeader: {
    paddingTop: 14,
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginLeft: -2,
    marginBottom: 4,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  closeButtonText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.clay,
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
  bodyContent: {
    paddingBottom: 20,
  },
  bodyContentWithCompactKeyboard: {
    paddingBottom: 44,
  },
  bodyContentWithNonIntervalDurationKeyboard: {
    paddingBottom: 72,
  },
  section: {
    paddingVertical: 14,
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
  recoverySection: {
    marginTop: 16,
  },
  stack: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginBottom: 8,
  },
  rowCopy: {
    gap: 4,
  },
  rowCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  rowPrompt: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    paddingTop: 8,
  },
  editorBlock: {
    gap: 10,
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
  primaryAction: {
    flex: 1,
  },
});
