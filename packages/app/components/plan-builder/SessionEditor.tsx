import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { normalizeSessionDuration, type PlannedSession, type SessionDurationUnit, type SessionType } from '@steady/types';
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
import { DAYS, REP_DISTS, RECOVERY_OPTS, TYPE_DEFAULTS, sessionLabel } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance } from '../../lib/units';

interface SessionEditorProps {
  dayIndex: number;
  existing: Partial<PlannedSession> | null;
  onSave: (dayIndex: number, session: Partial<PlannedSession> | null) => void;
  onClose: () => void;
  presentation?: 'sheet' | 'screen';
}

type ExpandedRow = 'distance' | 'pace' | 'warmup' | 'cooldown' | null;
type CustomField = Exclude<ExpandedRow, null> | null;

interface DurationState {
  unit: SessionDurationUnit;
  value: number | null;
}

const DISTANCE_PRESETS = [5, 8, 10, 12, 15];
const WARMUP_KM_PRESETS = [0, 1, 1.5, 2, 3];
const WARMUP_MIN_PRESETS = [5, 10, 15, 20];
const COOLDOWN_KM_PRESETS = [0, 0.5, 1, 1.5, 2];
const COOLDOWN_MIN_PRESETS = [5, 10, 15];
const SESSION_TYPES: SessionType[] = ['EASY', 'INTERVAL', 'TEMPO', 'LONG', 'REST'];
const PACE_PRESET_OFFSETS = [-15, -10, -5, 0, 5, 10, 15];
const MIN_TARGET_PACE_SECONDS = 150;
const MAX_TARGET_PACE_SECONDS = 720;

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

function buildDurationState(value: Partial<PlannedSession>['warmup']): DurationState {
  const normalized = normalizeSessionDuration(value);
  return {
    unit: normalized?.unit ?? 'km',
    value: normalized?.value ?? null,
  };
}

function durationPresets(field: 'warmup' | 'cooldown', unit: SessionDurationUnit): number[] {
  if (field === 'warmup') {
    return unit === 'km' ? WARMUP_KM_PRESETS : WARMUP_MIN_PRESETS;
  }

  return unit === 'km' ? COOLDOWN_KM_PRESETS : COOLDOWN_MIN_PRESETS;
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
  const [pace, setPace] = useState(existing?.pace || TYPE_DEFAULTS[init].pace || '4:30');
  const [recovery, setRecovery] = useState(existing?.recovery || '90s');
  const [warmup, setWarmup] = useState<DurationState>(() => buildDurationState(existing?.warmup));
  const [cooldown, setCooldown] = useState<DurationState>(() => buildDurationState(existing?.cooldown));
  const [expandedRow, setExpandedRow] = useState<ExpandedRow>(null);
  const [customField, setCustomField] = useState<CustomField>(null);
  const [customDistance, setCustomDistance] = useState('');
  const [customPace, setCustomPace] = useState('');
  const [customPaceSelected, setCustomPaceSelected] = useState(false);
  const [customWarmup, setCustomWarmup] = useState('');
  const [customCooldown, setCustomCooldown] = useState('');

  const isInterval = type === 'INTERVAL';
  const isRest = type === 'REST';
  const canEditPace = type === 'INTERVAL' || type === 'TEMPO';
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
      warmup: durationSpec(warmup),
      cooldown: durationSpec(cooldown),
    };

    if (isInterval) {
      Object.assign(session, { reps, repDist, recovery });
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
      setRecovery(defaults.recovery ?? '90s');
    } else if (nextType !== 'REST') {
      setDistance(defaults.distance ?? distance);
    }

    if (nextType === 'REST') {
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
      distance: 120,
      pace: 420,
      warmup: 540,
      cooldown: 660,
    };
    const y = scrollTargets[field];
    scrollRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
  }

  function openCustomField(field: Exclude<CustomField, null>) {
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
      {presentation === 'sheet' ? (
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
      ) : null}

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
          {isRest ? 'Rest day' : sessionLabel({ type, distance, reps, repDist, pace }, units)}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          customField ? styles.bodyContentWithKeyboard : null,
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

            {!isRest && isInterval ? (
              <View style={styles.section}>
                <SectionLabel>Repetitions</SectionLabel>
                <View style={styles.repsRow}>
                  <RepStepper value={reps} min={2} max={20} onChange={setReps} />
                  <Text style={styles.repsLabel}>reps</Text>
                </View>

                <SectionLabel>Rep distance</SectionLabel>
                <ChipRow
                  chips={REP_DISTS.map((value) => ({
                    key: String(value),
                    label: `${value}m`,
                    color: C.clay,
                  }))}
                  selected={String(repDist)}
                  onSelect={(value) => setRepDist(Number(value))}
                />

                <View style={styles.repSummary}>
                  <Text style={styles.repSummaryValue}>
                    {reps}×{repDist}m
                  </Text>
                  <Text style={styles.repSummaryNote}>
                    ≈{formatDistance((reps * repDist) / 1000, units)} reps
                  </Text>
                </View>

                <View style={styles.recoverySection}>
                  <SectionLabel>Recovery between reps</SectionLabel>
                  <ChipRow
                    chips={RECOVERY_OPTS.map((value) => ({ key: value, label: value, color: C.clay }))}
                    selected={recovery}
                    onSelect={(value) => setRecovery(value as typeof recovery)}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.stack}>
              <NotebookRow
                first
                label="Distance"
                onTap={!isRest && !isInterval ? () => toggleRow('distance') : undefined}
                expanded={expandedRow === 'distance'}
                editor={
                  expandedRow === 'distance' && !isRest && !isInterval ? (
                    <View style={styles.editorBlock}>
                      <ChipStripEditor
                        presets={DISTANCE_PRESETS}
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
                          setCustomDistance(distance ? formatValue(distance) : '');
                        }}
                        onCustomChangeText={(text) => handleCustomNumberChange('distance', text)}
                        onCustomBlur={() => closeCustomField('distance')}
                      />
                    </View>
                  ) : undefined
                }
              >
                {isRest ? (
                  <NotebookRowValue value="—" muted />
                ) : isInterval ? (
                  <View style={styles.rowCopy}>
                    <NotebookRowValue value={`${reps}×${repDist}m`} />
                    <Text style={styles.rowCaption}>Reps and distance stay above.</Text>
                  </View>
                ) : (
                  <NotebookRowValue value={formatValue(distance)} unit="km" />
                )}
              </NotebookRow>

              <NotebookRow
                label="Target pace"
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
                          setCustomPace(pace || '');
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
                      <Text style={styles.rowCaption}>{isInterval ? 'Per rep' : 'Tempo effort'}</Text>
                    ) : null}
                  </View>
                )}
              </NotebookRow>

              <NotebookRow
                label="Warm-up"
                trailing={(
                  <UnitTogglePill
                    value={warmup.unit}
                    onChange={(unit) => setDurationUnit('warmup', unit)}
                    disabled={isRest}
                  />
                )}
                onTap={!isRest ? () => toggleRow('warmup') : undefined}
                expanded={expandedRow === 'warmup'}
                disabled={isRest}
                editor={
                  expandedRow === 'warmup' && !isRest ? (
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
                          setCustomWarmup(warmup.value != null ? formatValue(warmup.value) : '');
                        }}
                        onCustomChangeText={(text) => handleCustomNumberChange('warmup', text)}
                        onCustomBlur={() => closeCustomField('warmup')}
                        onCustomFocus={() => keepCustomFieldVisible('warmup')}
                      />
                    </View>
                  ) : undefined
                }
              >
                {isRest ? (
                  <NotebookRowValue value="—" muted />
                ) : warmup.value != null ? (
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
                    disabled={isRest}
                  />
                )}
                onTap={!isRest ? () => toggleRow('cooldown') : undefined}
                expanded={expandedRow === 'cooldown'}
                disabled={isRest}
                editor={
                  expandedRow === 'cooldown' && !isRest ? (
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
                          setCustomCooldown(cooldown.value != null ? formatValue(cooldown.value) : '');
                        }}
                        onCustomChangeText={(text) => handleCustomNumberChange('cooldown', text)}
                        onCustomBlur={() => closeCustomField('cooldown')}
                        onCustomFocus={() => keepCustomFieldVisible('cooldown')}
                      />
                    </View>
                  ) : undefined
                }
              >
                {isRest ? (
                  <NotebookRowValue value="—" muted />
                ) : cooldown.value != null ? (
                  <View style={styles.rowCopy}>
                    <NotebookRowValue value={formatValue(cooldown.value)} unit={cooldown.unit} />
                    <Text style={styles.rowCaption}>Easy</Text>
                  </View>
                ) : (
                  <Text style={styles.rowPrompt}>Tap to set</Text>
                )}
              </NotebookRow>
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          testID="session-editor-keyboard-frame"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboardFrame}
        >
          {content}
        </KeyboardAvoidingView>
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
  sheetKeyboardFrame: {
    flex: 1,
    justifyContent: 'flex-end',
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
  bodyContentWithKeyboard: {
    paddingBottom: 160,
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
