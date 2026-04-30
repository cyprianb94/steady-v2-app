import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  defaultIntensityTargetForSessionType,
  deriveSessionFocus,
  normalizeRunStructure,
  structuredSessionVolume,
  summariseRunStructure,
  type IntensityTarget,
  type PlannedSession,
  type RunStructure,
  type RunStructureItem,
  type RunStructureSegment,
  type RunStructureSegmentKind,
  type RunStructureVolume,
  type RunStructureVolumeUnit,
  type SessionDurationSpec,
  type SessionType,
} from '@steady/types';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { Btn } from '../ui/Btn';
import { SectionLabel } from '../ui/SectionLabel';

interface RunStructureEditorProps {
  dayIndex: number;
  session: Partial<PlannedSession>;
  onSave: (dayIndex: number, session: Partial<PlannedSession>) => void;
  onClose: () => void;
}

type TemplateKey =
  | 'custom'
  | 'fast-finish'
  | 'progression'
  | 'race-pace-blocks'
  | 'cruise-intervals'
  | 'short-reps'
  | 'strides'
  | 'fartlek-ladder';

interface StructureTemplate {
  key: TemplateKey;
  label: string;
  caption: string;
  roles: Exclude<SessionType, 'RECOVERY' | 'REST'>[];
  build: (session: Partial<PlannedSession>) => Partial<PlannedSession>;
}

const VOLUME_UNITS: RunStructureVolumeUnit[] = ['km', 'min', 'sec'];
const SEGMENT_KINDS: RunStructureSegmentKind[] = [
  'WARMUP',
  'RUN',
  'RECOVERY',
  'FLOAT',
  'REST',
  'STRIDE',
  'COOLDOWN',
];

function target(profileKey: IntensityTarget['profileKey'], effortCue: IntensityTarget['effortCue']): IntensityTarget {
  return {
    source: 'manual',
    mode: 'effort',
    profileKey,
    effortCue,
  };
}

const EASY_TARGET = target('easy', 'conversational');
const MARATHON_TARGET = target('marathon', 'race pace');
const THRESHOLD_TARGET = target('threshold', 'controlled hard');
const INTERVAL_TARGET = target('interval', 'hard repeatable');

function plannedVolumeFor(session: Partial<PlannedSession>): SessionDurationSpec | undefined {
  if (session.plannedVolume?.unit === 'km' || session.plannedVolume?.unit === 'min') {
    return session.plannedVolume;
  }
  if (session.distance != null && session.distance > 0) {
    return { unit: 'km', value: session.distance };
  }
  return undefined;
}

function topLevelKm(session: Partial<PlannedSession>, fallback: number): number {
  if (session.plannedVolume?.unit === 'km') return session.plannedVolume.value;
  if (session.distance != null && session.distance > 0) return session.distance;
  return fallback;
}

function topLevelMinutes(session: Partial<PlannedSession>, fallback: number): number {
  if (session.plannedVolume?.unit === 'min') return session.plannedVolume.value;
  return fallback;
}

function segment(
  kind: RunStructureSegmentKind,
  volume: RunStructureVolume,
  intensityTarget?: IntensityTarget,
  extras: Partial<RunStructureSegment> = {},
): RunStructureSegment {
  return {
    kind,
    volume,
    ...(intensityTarget ? { intensityTarget } : null),
    ...extras,
  };
}

function repeat(repeats: number, segments: RunStructureSegment[]): RunStructureItem {
  return {
    kind: 'REPEAT',
    repeats,
    segments,
  };
}

function simpleIntervalStructure(session: Partial<PlannedSession>): RunStructureItem[] {
  const repVolume: RunStructureVolume = session.repDuration
    ? { unit: session.repDuration.unit, value: session.repDuration.value }
    : { unit: 'km', value: (session.repDist ?? 800) / 1000 };
  const recoveryVolume: RunStructureVolume = typeof session.recovery === 'object' && session.recovery
    ? { unit: session.recovery.unit, value: session.recovery.value }
    : { unit: 'min', value: 1.5 };

  return [
    repeat(session.reps ?? 6, [
      segment('RUN', repVolume, session.intensityTarget ?? INTERVAL_TARGET),
      segment('RECOVERY', recoveryVolume, EASY_TARGET),
    ]),
  ];
}

function customStructure(session: Partial<PlannedSession>): Partial<PlannedSession> {
  const existing = normalizeRunStructure(session.runStructure);
  if (existing) {
    return {
      ...session,
      runStructure: existing,
    };
  }

  const type = session.type ?? 'EASY';
  if (type === 'INTERVAL') {
    return {
      ...session,
      runStructure: { items: simpleIntervalStructure(session) },
    };
  }

  const planned = plannedVolumeFor(session);
  const volume: RunStructureVolume = planned
    ? { unit: planned.unit, value: planned.value }
    : { unit: 'km', value: 8 };

  return {
    ...session,
    plannedVolume: planned ?? session.plannedVolume,
    runStructure: {
      items: [
        segment('RUN', volume, session.intensityTarget ?? defaultIntensityTargetForSessionType(type)),
      ],
    },
  };
}

const TEMPLATES: StructureTemplate[] = [
  {
    key: 'fast-finish',
    label: 'Fast finish',
    caption: 'Easy running, then a controlled finish.',
    roles: ['EASY', 'TEMPO', 'LONG'],
    build: (session) => {
      const totalKm = topLevelKm(session, session.type === 'LONG' ? 18 : 10);
      const finishKm = Math.min(5, Math.max(2, Math.round(totalKm * 0.25)));
      return {
        ...session,
        plannedVolume: { unit: 'km', value: totalKm },
        distance: totalKm,
        runStructure: {
          items: [
            segment('RUN', { unit: 'km', value: Math.max(1, totalKm - finishKm) }, EASY_TARGET),
            segment('RUN', { unit: 'km', value: finishKm }, MARATHON_TARGET),
          ],
        },
      };
    },
  },
  {
    key: 'progression',
    label: 'Progression',
    caption: 'One continuous run with start and finish intent.',
    roles: ['EASY', 'TEMPO', 'LONG'],
    build: (session) => ({
      ...session,
      plannedVolume: { unit: 'min', value: topLevelMinutes(session, 60) },
      distance: undefined,
      runStructure: {
        items: [
          segment('RUN', { unit: 'min', value: topLevelMinutes(session, 60) }, undefined, {
            progression: {
              from: EASY_TARGET,
              to: session.type === 'TEMPO' ? THRESHOLD_TARGET : MARATHON_TARGET,
            },
          }),
        ],
      },
    }),
  },
  {
    key: 'race-pace-blocks',
    label: 'Race-pace blocks',
    caption: 'Marathon-pace work with float recoveries.',
    roles: ['LONG'],
    build: (session) => {
      const totalKm = topLevelKm(session, 26);
      return {
        ...session,
        plannedVolume: { unit: 'km', value: totalKm },
        distance: totalKm,
        runStructure: {
          items: [
            repeat(3, [
              segment('RUN', { unit: 'km', value: 3 }, MARATHON_TARGET),
              segment('FLOAT', { unit: 'km', value: 1 }, EASY_TARGET),
            ]),
          ],
        },
      };
    },
  },
  {
    key: 'cruise-intervals',
    label: 'Cruise intervals',
    caption: 'Threshold blocks with jog recoveries.',
    roles: ['TEMPO', 'INTERVAL'],
    build: (session) => ({
      ...session,
      runStructure: {
        items: [
          repeat(3, [
            segment('RUN', { unit: 'min', value: 10 }, THRESHOLD_TARGET),
            segment('RECOVERY', { unit: 'min', value: 2 }, EASY_TARGET),
          ]),
        ],
      },
    }),
  },
  {
    key: 'short-reps',
    label: 'Short reps',
    caption: 'Short controlled repetitions with easy recoveries.',
    roles: ['INTERVAL'],
    build: (session) => ({
      ...session,
      runStructure: {
        items: [
          repeat(10, [
            segment('RUN', { unit: 'sec', value: 30 }, INTERVAL_TARGET),
            segment('RECOVERY', { unit: 'sec', value: 60 }, EASY_TARGET),
          ]),
        ],
      },
    }),
  },
  {
    key: 'strides',
    label: 'Strides',
    caption: 'Keep the parent run easy; add short relaxed strides.',
    roles: ['EASY'],
    build: (session) => {
      const totalKm = topLevelKm(session, 8);
      return {
        ...session,
        plannedVolume: { unit: 'km', value: totalKm },
        distance: totalKm,
        runStructure: {
          items: [
            segment('RUN', { unit: 'km', value: totalKm }, EASY_TARGET),
            repeat(6, [
              segment('STRIDE', { unit: 'sec', value: 20 }, INTERVAL_TARGET),
            ]),
          ],
        },
      };
    },
  },
  {
    key: 'fartlek-ladder',
    label: 'Fartlek ladder',
    caption: 'Multiple repeat groups with different durations.',
    roles: ['INTERVAL'],
    build: (session) => ({
      ...session,
      runStructure: {
        items: [
          repeat(4, [
            segment('RUN', { unit: 'sec', value: 90 }, INTERVAL_TARGET),
            segment('RECOVERY', { unit: 'sec', value: 90 }, EASY_TARGET),
          ]),
          repeat(4, [
            segment('RUN', { unit: 'min', value: 1 }, INTERVAL_TARGET),
            segment('RECOVERY', { unit: 'min', value: 1 }, EASY_TARGET),
          ]),
          repeat(4, [
            segment('RUN', { unit: 'sec', value: 30 }, INTERVAL_TARGET),
            segment('RECOVERY', { unit: 'sec', value: 30 }, EASY_TARGET),
          ]),
        ],
      },
    }),
  },
  {
    key: 'custom',
    label: 'Custom',
    caption: 'Start from the current session and adjust parts.',
    roles: ['EASY', 'INTERVAL', 'TEMPO', 'LONG'],
    build: customStructure,
  },
];

function cloneItems(items: RunStructureItem[]): RunStructureItem[] {
  return items.map((item) => (
    item.kind === 'REPEAT'
      ? {
          ...item,
          segments: item.segments.map((child) => ({
            ...child,
            volume: { ...child.volume },
            intensityTarget: child.intensityTarget ? { ...child.intensityTarget } : undefined,
            progression: child.progression
              ? {
                  from: child.progression.from ? { ...child.progression.from } : undefined,
                  to: child.progression.to ? { ...child.progression.to } : undefined,
                }
              : undefined,
          })),
        }
      : {
          ...item,
          volume: { ...item.volume },
          intensityTarget: item.intensityTarget ? { ...item.intensityTarget } : undefined,
          progression: item.progression
            ? {
                from: item.progression.from ? { ...item.progression.from } : undefined,
                to: item.progression.to ? { ...item.progression.to } : undefined,
              }
            : undefined,
        }
  ));
}

function templateForCurrentSession(session: Partial<PlannedSession>): TemplateKey {
  return normalizeRunStructure(session.runStructure) ? 'custom' : 'custom';
}

function formatVolume(volume: RunStructureVolume): string {
  if (volume.unit === 'sec') return `${volume.value}s`;
  return `${volume.value}${volume.unit}`;
}

function totalLine(session: PlannedSession): string {
  const volume = structuredSessionVolume(session);
  const parts: string[] = [];

  if (volume.exactKm > 0) parts.push(`${volume.exactKm}km exact`);
  if (volume.estimatedKm > 0) parts.push(`${volume.estimatedKm}km estimated`);
  if (volume.plannedMinutes > 0) parts.push(`${volume.plannedMinutes}min planned`);
  if (volume.structuredSeconds > 0) parts.push(`${volume.structuredSeconds}s structured`);

  return parts.length > 0 ? parts.join(' · ') : 'No measurable volume yet';
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function segmentKindLabel(kind: RunStructureSegmentKind): string {
  switch (kind) {
    case 'WARMUP':
      return 'Warm-up';
    case 'RUN':
      return 'Run';
    case 'RECOVERY':
      return 'Recovery';
    case 'FLOAT':
      return 'Float';
    case 'REST':
      return 'Rest';
    case 'STRIDE':
      return 'Stride';
    case 'COOLDOWN':
      return 'Cool-down';
  }
}

function mismatchWarning(session: PlannedSession): string | null {
  const normalized = normalizeRunStructure(session.runStructure);
  if (!normalized) return null;

  const volume = structuredSessionVolume(session);
  const planned = plannedVolumeFor(session);
  if (planned?.unit === 'km' && volume.structuredExactKm > 0) {
    const delta = Math.abs(planned.value - volume.structuredExactKm);
    return delta > 0.2
      ? `Structure totals ${volume.structuredExactKm}km inside a ${planned.value}km session. Save is still allowed.`
      : null;
  }

  if (planned?.unit === 'min' && volume.structuredSeconds > 0) {
    const structuredMinutes = Math.round(volume.structuredSeconds / 60);
    const delta = Math.abs(planned.value - structuredMinutes);
    return delta > 2
      ? `Structure totals ${structuredMinutes}min inside a ${planned.value}min session. Save is still allowed.`
      : null;
  }

  return null;
}

function materializeSession(
  session: Partial<PlannedSession>,
  items: RunStructureItem[],
  planNote: string,
): PlannedSession {
  const normalized = normalizeRunStructure({ items });
  const type = session.type ?? 'EASY';

  return {
    ...session,
    id: session.id ?? 'run-structure-draft',
    date: session.date ?? 'draft',
    type,
    intensityTarget: session.intensityTarget ?? defaultIntensityTargetForSessionType(type),
    planNote: planNote.trim() || undefined,
    runStructure: normalized ?? { items },
  } as PlannedSession;
}

export function RunStructureEditor({
  dayIndex,
  session,
  onSave,
  onClose,
}: RunStructureEditorProps) {
  const initial = customStructure(session);
  const normalized = normalizeRunStructure(initial.runStructure);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>(() => templateForCurrentSession(session));
  const [draftSession, setDraftSession] = useState<Partial<PlannedSession>>(initial);
  const [items, setItems] = useState<RunStructureItem[]>(() => cloneItems(normalized?.items ?? []));
  const [planNote, setPlanNote] = useState(initial.planNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const type = draftSession.type ?? session.type ?? 'EASY';
  const typeMeta = SESSION_TYPE[type];
  const availableTemplates = useMemo(
    () => TEMPLATES.filter((template) => template.roles.includes(type as Exclude<SessionType, 'RECOVERY' | 'REST'>)),
    [type],
  );
  const materialized = materializeSession(draftSession, items, planNote);
  const summary = summariseRunStructure(materialized);
  const warning = mismatchWarning(materialized);

  function applyTemplate(template: StructureTemplate) {
    const next = template.build({
      ...draftSession,
      type,
      planNote,
    });
    const nextStructure = normalizeRunStructure(next.runStructure);
    setSelectedTemplate(template.key);
    setDraftSession(next);
    setItems(cloneItems(nextStructure?.items ?? []));
    setError(null);
  }

  function updateSegment(
    itemIndex: number,
    segmentIndex: number | null,
    updater: (segment: RunStructureSegment) => RunStructureSegment,
  ) {
    setItems((current) => current.map((item, index) => {
      if (index !== itemIndex) return item;
      if (item.kind === 'REPEAT') {
        return {
          ...item,
          segments: item.segments.map((child, childIndex) => (
            childIndex === segmentIndex ? updater(child) : child
          )),
        };
      }
      return segmentIndex == null ? updater(item) : item;
    }));
  }

  function setRepeatCount(itemIndex: number, repeats: number) {
    setItems((current) => current.map((item, index) => (
      index === itemIndex && item.kind === 'REPEAT'
        ? { ...item, repeats: Math.max(1, Math.min(40, repeats)) }
        : item
    )));
  }

  function addRunSegment() {
    setItems((current) => [
      ...current,
      segment('RUN', { unit: 'km', value: 1 }, defaultIntensityTargetForSessionType(type)),
    ]);
    setSelectedTemplate('custom');
  }

  function addRepeatGroup() {
    setItems((current) => [
      ...current,
      repeat(4, [
        segment('RUN', { unit: 'min', value: 1 }, type === 'TEMPO' ? THRESHOLD_TARGET : INTERVAL_TARGET),
        segment('RECOVERY', { unit: 'min', value: 1 }, EASY_TARGET),
      ]),
    ]);
    setSelectedTemplate('custom');
  }

  function save() {
    const normalizedStructure = normalizeRunStructure({ items });
    if (!normalizedStructure) {
      if (planNote.trim()) {
        onSave(dayIndex, {
          ...draftSession,
          type,
          planNote: planNote.trim(),
          runStructure: undefined,
        });
        return;
      }

      setError('Add at least one valid segment before saving.');
      return;
    }

    const next: Partial<PlannedSession> = {
      ...draftSession,
      type,
      planNote: planNote.trim() || undefined,
      runStructure: normalizedStructure,
    };

    onSave(dayIndex, next);
  }

  function removeItem(itemIndex: number) {
    setItems((current) => current.filter((_, index) => index !== itemIndex));
    setSelectedTemplate('custom');
  }

  function renderKindChips(
    itemIndex: number,
    segmentIndex: number | null,
    value: RunStructureSegmentKind,
  ) {
    return (
      <View style={styles.kindRow}>
        {SEGMENT_KINDS.map((kind) => {
          const active = kind === value;
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              onPress={() => {
                updateSegment(itemIndex, segmentIndex, (current) => ({ ...current, kind }));
                setSelectedTemplate('custom');
              }}
              style={[
                styles.kindChip,
                active && {
                  borderColor: typeMeta.color,
                  backgroundColor: `${typeMeta.color}18`,
                },
              ]}
            >
              <Text style={[styles.kindChipText, active && { color: typeMeta.color }]}>
                {segmentKindLabel(kind)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderUnitChips(
    itemIndex: number,
    segmentIndex: number | null,
    value: RunStructureVolumeUnit,
  ) {
    return (
      <View style={styles.unitRow}>
        {VOLUME_UNITS.map((unit) => {
          const active = value === unit;
          return (
            <Pressable
              key={unit}
              accessibilityRole="button"
              onPress={() => {
                updateSegment(itemIndex, segmentIndex, (current) => ({
                  ...current,
                  volume: { unit, value: current.volume.value },
                }));
                setSelectedTemplate('custom');
              }}
              style={[
                styles.unitChip,
                active && {
                  borderColor: typeMeta.color,
                  backgroundColor: `${typeMeta.color}18`,
                },
              ]}
            >
              <Text style={[styles.unitChipText, active && { color: typeMeta.color }]}>
                {unit.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderSegment(
    segmentValue: RunStructureSegment,
    itemIndex: number,
    segmentIndex: number | null,
  ) {
    return (
      <View style={styles.segmentBlock} key={`${itemIndex}-${segmentIndex ?? 'single'}`}>
        <View style={styles.segmentTopLine}>
          <Text style={styles.segmentTitle}>{segmentKindLabel(segmentValue.kind)}</Text>
          <Text style={styles.segmentVolume}>{formatVolume(segmentValue.volume)}</Text>
        </View>
        {renderKindChips(itemIndex, segmentIndex, segmentValue.kind)}
        <View style={styles.volumeEditRow}>
          <TextInput
            testID={`run-structure-volume-${itemIndex}-${segmentIndex ?? 'single'}`}
            value={String(segmentValue.volume.value)}
            onChangeText={(text) => {
              const parsed = parsePositiveNumber(text);
              if (parsed == null) return;
              updateSegment(itemIndex, segmentIndex, (current) => ({
                ...current,
                volume: { ...current.volume, value: parsed },
              }));
              setSelectedTemplate('custom');
            }}
            keyboardType="numbers-and-punctuation"
            selectionColor={typeMeta.color}
            style={[styles.volumeInput, { borderColor: typeMeta.color }]}
          />
          {renderUnitChips(itemIndex, segmentIndex, segmentValue.volume.unit)}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      testID="run-structure-editor"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        >
          <Text style={styles.closeButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerEyebrow}>{SESSION_TYPE[type].label}</Text>
        <Text style={[styles.title, { color: typeMeta.color }]}>Run structure</Text>
        <Text style={styles.subtitle}>{deriveSessionFocus(materialized)}</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <SectionLabel>Template</SectionLabel>
          <View style={styles.templateGrid}>
            {availableTemplates.map((template) => {
              const active = selectedTemplate === template.key;
              return (
                <Pressable
                  key={template.key}
                  accessibilityRole="button"
                  onPress={() => applyTemplate(template)}
                  style={[
                    styles.templateCard,
                    active && {
                      borderColor: typeMeta.color,
                      backgroundColor: `${typeMeta.color}12`,
                    },
                  ]}
                >
                  <Text style={[styles.templateTitle, active && { color: typeMeta.color }]}>
                    {template.label}
                  </Text>
                  <Text style={styles.templateCaption}>{template.caption}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Plan note</SectionLabel>
          <TextInput
            multiline
            value={planNote}
            onChangeText={setPlanNote}
            placeholder="Add coach wording or context."
            placeholderTextColor={C.muted}
            selectionColor={typeMeta.color}
            style={styles.planNoteInput}
          />
        </View>

        <View style={styles.summaryPanel}>
          <Text style={styles.summaryLabel}>Calculated total</Text>
          <Text style={styles.summaryText}>{totalLine(materialized)}</Text>
          {summary ? <Text style={styles.summaryText}>{summary}</Text> : null}
          {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.section}>
          <SectionLabel>Segments</SectionLabel>
          <View style={styles.itemsList}>
            {items.map((item, itemIndex) => (
              <View style={styles.itemCard} key={itemIndex}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemTitle}>
                      {item.kind === 'REPEAT' ? 'Repeat group' : segmentKindLabel(item.kind)}
                    </Text>
                    {item.kind === 'REPEAT' ? (
                      <Text style={styles.itemCaption}>{item.repeats} repeats</Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => removeItem(itemIndex)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                </View>

                {item.kind === 'REPEAT' ? (
                  <>
                    <View style={styles.repeatControls}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setRepeatCount(itemIndex, item.repeats - 1)}
                        style={styles.repeatButton}
                      >
                        <Text style={styles.repeatButtonText}>-</Text>
                      </Pressable>
                      <Text style={styles.repeatValue}>{item.repeats}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setRepeatCount(itemIndex, item.repeats + 1)}
                        style={styles.repeatButton}
                      >
                        <Text style={styles.repeatButtonText}>+</Text>
                      </Pressable>
                    </View>
                    <View style={styles.repeatSegments}>
                      {item.segments.map((child, childIndex) => renderSegment(child, itemIndex, childIndex))}
                    </View>
                  </>
                ) : (
                  renderSegment(item, itemIndex, null)
                )}
              </View>
            ))}
          </View>

          <View style={styles.addRow}>
            <Btn title="Add segment" variant="secondary" onPress={addRunSegment} />
            <Btn title="Add repeat" variant="secondary" onPress={addRepeatGroup} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Btn title="Save run structure" fullWidth onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginLeft: -2,
    marginBottom: 10,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  closeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.clay,
  },
  headerEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 5,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingTop: 18,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 18,
  },
  templateGrid: {
    gap: 8,
  },
  templateCard: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    padding: 13,
    gap: 4,
  },
  templateTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  templateCaption: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  planNoteInput: {
    minHeight: 78,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
    textAlignVertical: 'top',
  },
  summaryPanel: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    gap: 5,
  },
  summaryLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: C.muted,
  },
  summaryText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: C.ink,
  },
  warningText: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.statusConnected,
  },
  errorText: {
    marginTop: 4,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: C.clay,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    padding: 12,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  itemCaption: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  removeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.clay,
  },
  repeatControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repeatButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  repeatButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 18,
    color: C.ink,
  },
  repeatValue: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: FONTS.monoBold,
    fontSize: 16,
    color: C.ink,
  },
  repeatSegments: {
    gap: 10,
  },
  segmentBlock: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    gap: 10,
  },
  segmentTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  segmentTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  segmentVolume: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink2,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kindChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  kindChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
  },
  volumeEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  volumeInput: {
    width: 72,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
    textAlign: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  unitChip: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  unitChipText: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: C.muted,
  },
  addRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
});
