import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeSessionDuration, type PlannedSession, type SessionDurationUnit, type SessionType } from '@steady/types';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { Btn } from '../ui/Btn';
import { ChipRow } from '../ui/ChipRow';
import { ChipStripEditor } from '../ui/ChipStripEditor';
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
}

type ExpandedRow = 'distance' | 'warmup' | 'cooldown' | null;
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

export function SessionEditor({ dayIndex, existing, onSave, onClose }: SessionEditorProps) {
  const { units } = usePreferences();
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
  const [customWarmup, setCustomWarmup] = useState('');
  const [customCooldown, setCustomCooldown] = useState('');

  const isInterval = type === 'INTERVAL';
  const isRest = type === 'REST';
  const typeMeta = SESSION_TYPE[type];

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

  function renderCustomInput(field: Exclude<CustomField, null>) {
    if (customField !== field) {
      return null;
    }

    const isDistanceField = field === 'distance';
    const duration = field === 'warmup' ? warmup : cooldown;
    const value = isDistanceField
      ? customDistance
      : field === 'warmup'
        ? customWarmup
        : customCooldown;
    const placeholder = isDistanceField
      ? 'Custom km'
      : `Custom ${duration.unit}`;
    const allowDecimal = isDistanceField || duration.unit === 'km';

    return (
      <View style={styles.customWrap}>
        <TextInput
          autoFocus
          value={value}
          onChangeText={(text) => {
            if (field === 'distance') {
              setCustomDistance(text);
              const parsed = parseCustomValue(text, true);
              if (parsed != null) {
                setDistance(parsed);
              }
              return;
            }

            if (field === 'warmup') {
              setCustomWarmup(text);
            } else {
              setCustomCooldown(text);
            }

            const parsed = parseCustomValue(text, allowDecimal);
            if (parsed != null) {
              setDurationValue(field, parsed === 0 ? null : parsed);
            }
          }}
          keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          selectionColor={C.clay}
          style={styles.customInput}
        />
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.headerDay}>{DAYS[dayIndex]}</Text>
            <Text style={[styles.headerTitle, { color: typeMeta.color }]}>
              {isRest ? 'Rest day' : sessionLabel({ type, distance, reps, repDist, pace }, units)}
            </Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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
                        onSelect={setDistance}
                        onCustom={() => {
                          setCustomField('distance');
                          setCustomDistance(distance ? formatValue(distance) : '');
                        }}
                      />
                      {renderCustomInput('distance')}
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

              <NotebookRow label="Target pace">
                {isRest ? (
                  <NotebookRowValue value="—" muted />
                ) : (
                  <NotebookRowValue value={pace || '—'} unit="/km" />
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
                        onSelect={(value) => setDurationValue('warmup', value === 0 ? null : value)}
                        onCustom={() => {
                          setCustomField('warmup');
                          setCustomWarmup(warmup.value != null ? formatValue(warmup.value) : '');
                        }}
                      />
                      {renderCustomInput('warmup')}
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
                        onSelect={(value) => setDurationValue('cooldown', value === 0 ? null : value)}
                        onCustom={() => {
                          setCustomField('cooldown');
                          setCustomCooldown(cooldown.value != null ? formatValue(cooldown.value) : '');
                        }}
                      />
                      {renderCustomInput('cooldown')}
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
  customWrap: {
    marginTop: 2,
  },
  customInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink,
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
