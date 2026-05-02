import React, { useMemo, useState } from 'react';
import {
  Animated,
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
  normalizeIntensityTarget,
  normalizePace,
  structuredSessionVolume,
  summariseRunStructure,
  type IntensityTarget,
  type PlannedSession,
  type RunStructureItem,
  type RunStructureSegment,
  type RunStructureSegmentKind,
  type RunStructureVolume,
  type RunStructureVolumeUnit,
  type SessionFormat,
  type SessionType,
  type TrainingPaceProfile,
  type TrainingPaceProfileKey,
} from '@steady/types';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import {
  useDirectListReorder,
  type DirectListReorderDragState,
} from '../../features/plan-builder/use-direct-list-reorder';
import {
  applyStructuredSessionTemplate,
  buildStructuredSessionSave,
  cloneRunStructureItems,
  convertStructuredSessionDraftToSimple,
  createStructuredSessionDraft,
  getStructuredSessionTemplatesForType,
  materializeStructuredSessionDraft,
  runStructureRepeat as repeat,
  runStructureSegment as segment,
  structuredSessionMismatchWarning,
  type StructuredSessionTemplateKey,
} from '../../features/plan-builder/structured-session-editor-engine';
import {
  getSessionEditorProfileBands,
  intensityTargetForTrainingPaceProfileKey,
  manualPaceIntensityTarget,
  targetRepresentativePace,
} from '../../features/plan-builder/session-editing';
import { formatIntensityTargetParts } from '../../lib/units';
import { usePreferences } from '../../providers/preferences-context';
import { Btn } from '../ui/Btn';
import { ChipRow } from '../ui/ChipRow';
import { ChipStripEditor } from '../ui/ChipStripEditor';
import { EditableChipStrip, type EditableChipOption } from '../ui/EditableChipStrip';
import { SectionLabel } from '../ui/SectionLabel';
import { UnitTogglePill } from '../ui/UnitTogglePill';
import { DragHandle } from './DragHandle';

interface RunStructureEditorProps {
  dayIndex: number;
  session: Partial<PlannedSession>;
  trainingPaceProfile?: TrainingPaceProfile | null;
  onSave: (dayIndex: number, session: Partial<PlannedSession>) => void;
  onClose: () => void;
  onChangeFormat?: (format: SessionFormat, session: Partial<PlannedSession>) => void;
}

type TemplateKey =
  StructuredSessionTemplateKey;

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
const DISTANCE_PRESETS = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 5, 8, 10];
const MINUTE_PRESETS = [0.5, 1, 1.5, 2, 3, 5, 10, 20, 30, 45, 60];
const SECOND_PRESETS = [20, 30, 45, 60, 90];
const PACE_PRESET_OFFSETS = [-15, -10, -5, 0, 5, 10, 15];
const MIN_TARGET_PACE_SECONDS = 150;
const MAX_TARGET_PACE_SECONDS = 720;
const STRUCTURED_SESSION_TYPES: Exclude<SessionType, 'RECOVERY' | 'REST'>[] = [
  'EASY',
  'INTERVAL',
  'TEMPO',
  'LONG',
];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function formatVolume(volume: RunStructureVolume): string {
  if (volume.unit === 'sec') return `${volume.value}s`;
  return `${volume.value}${volume.unit}`;
}

function volumePresets(unit: RunStructureVolumeUnit): number[] {
  if (unit === 'km') return DISTANCE_PRESETS;
  if (unit === 'sec') return SECOND_PRESETS;
  return MINUTE_PRESETS;
}

function volumeMetricColor(unit: RunStructureVolumeUnit): string {
  return unit === 'km' ? C.metricDistance : C.metricTime;
}

function paceToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
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
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return null;
  }

  const total = minutes * 60 + seconds;
  return total > 0 ? secondsToPace(total) : null;
}

function pacePresets(currentPace: string | null | undefined): string[] {
  const baseSeconds = paceToSeconds(currentPace) ?? paceToSeconds('4:30')!;
  const presets = PACE_PRESET_OFFSETS
    .map((offset) => baseSeconds + offset)
    .filter((seconds) => seconds >= MIN_TARGET_PACE_SECONDS && seconds <= MAX_TARGET_PACE_SECONDS)
    .map(secondsToPace);

  return Array.from(new Set(presets));
}

function segmentPaceSessionType(
  parentType: SessionType,
  segmentKind: RunStructureSegmentKind,
): SessionType {
  if (segmentKind === 'WARMUP' || segmentKind === 'RECOVERY' || segmentKind === 'COOLDOWN') {
    return 'RECOVERY';
  }
  if (segmentKind === 'FLOAT') {
    return 'EASY';
  }
  if (segmentKind === 'STRIDE') {
    return 'INTERVAL';
  }
  if (segmentKind === 'REST') {
    return 'REST';
  }
  return parentType;
}

function targetForProfileKey(
  profile: TrainingPaceProfile | null | undefined,
  profileKey: TrainingPaceProfileKey,
): IntensityTarget {
  return intensityTargetForTrainingPaceProfileKey(profile, profileKey)
    ?? {
      source: 'profile',
      mode: 'effort',
      profileKey,
    };
}

function segmentPaceOptions(
  parentType: SessionType,
  segmentValue: RunStructureSegment,
  profile: TrainingPaceProfile | null | undefined,
  units: 'metric' | 'imperial',
): EditableChipOption[] {
  const type = segmentPaceSessionType(parentType, segmentValue.kind);
  if (type === 'REST') return [];

  return getSessionEditorProfileBands(type, profile, segmentValue.intensityTarget)
    .map((band) => {
      const target = targetForProfileKey(profile, band.profileKey);
      const parts = formatIntensityTargetParts(target, units, { withUnit: true });
      return {
        key: band.profileKey,
        label: band.label,
        caption: parts.label ?? band.defaultEffortCue,
      };
    });
}

function selectedSegmentPaceKey(segmentValue: RunStructureSegment): string | null {
  const target = normalizeIntensityTarget(segmentValue.intensityTarget);
  if (target?.source === 'profile' && target.profileKey) {
    return target.profileKey;
  }
  if (target?.source === 'manual' && target.profileKey && !target.pace && !target.paceRange) {
    return target.profileKey;
  }
  return normalizePace(target?.pace) ?? null;
}

function volumesMatch(a: RunStructureVolume, b: RunStructureVolume): boolean {
  return a.unit === b.unit && a.value === b.value;
}

function intensityTargetsMatch(
  a: IntensityTarget | null | undefined,
  b: IntensityTarget | null | undefined,
): boolean {
  return JSON.stringify(normalizeIntensityTarget(a) ?? null) === JSON.stringify(normalizeIntensityTarget(b) ?? null);
}

function segmentIntensityLabel(segmentValue: RunStructureSegment, units: 'metric' | 'imperial'): string {
  const profile = segmentValue.intensityTarget?.profileKey;
  const effort = segmentValue.intensityTarget?.effortCue;
  const targetParts = formatIntensityTargetParts(segmentValue.intensityTarget, units, { withUnit: true });
  if (segmentValue.progression?.from || segmentValue.progression?.to) {
    const from = segmentValue.progression.from?.profileKey ?? segmentValue.progression.from?.effortCue ?? 'easy';
    const to = segmentValue.progression.to?.profileKey ?? segmentValue.progression.to?.effortCue ?? 'finish';
    return `${from} to ${to}`;
  }

  if (targetParts.label) return targetParts.label;
  if (profile && effort) return `${profile} range · ${effort}`;
  if (profile) return `${profile} range`;
  if (effort) return effort;
  return 'No target set';
}

function isQualitySegment(segmentValue: RunStructureSegment): boolean {
  const key = segmentValue.intensityTarget?.profileKey;
  return segmentValue.kind === 'STRIDE'
    || key === 'marathon'
    || key === 'threshold'
    || key === 'interval';
}

function addSegmentVolume(
  current: { km: number; seconds: number },
  segmentValue: RunStructureSegment,
  multiplier = 1,
) {
  if (segmentValue.volume.unit === 'km') {
    current.km += segmentValue.volume.value * multiplier;
  } else if (segmentValue.volume.unit === 'min') {
    current.seconds += segmentValue.volume.value * 60 * multiplier;
  } else {
    current.seconds += segmentValue.volume.value * multiplier;
  }
}

function qualityVolume(items: RunStructureItem[]): { km: number; seconds: number } {
  const quality = { km: 0, seconds: 0 };
  items.forEach((item) => {
    if (item.kind === 'REPEAT') {
      item.segments.forEach((child) => {
        if (isQualitySegment(child)) {
          addSegmentVolume(quality, child, item.repeats);
        }
      });
      return;
    }

    if (isQualitySegment(item)) {
      addSegmentVolume(quality, item);
    }
  });
  return quality;
}

function formatVolumeSummary(volume: { km: number; seconds: number }): string {
  if (volume.km > 0) {
    const rounded = Math.round(volume.km * 10) / 10;
    return `${rounded}km`;
  }
  if (volume.seconds > 0) {
    const minutes = volume.seconds / 60;
    return minutes >= 1 ? `${Math.round(minutes * 10) / 10}min` : `${volume.seconds}s`;
  }
  return '0';
}

function repeatsMetric(items: RunStructureItem[]): { value: string; caption: string } {
  const groups = items.filter((item): item is Extract<RunStructureItem, { kind: 'REPEAT' }> => item.kind === 'REPEAT');
  if (groups.length === 0) return { value: '0', caption: 'none' };
  if (groups.length === 1) return { value: String(groups[0].repeats), caption: 'rounds' };
  return { value: String(groups.length), caption: 'groups' };
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function structuredKm(volume: ReturnType<typeof structuredSessionVolume>): number {
  return roundKm(volume.structuredExactKm + volume.structuredEstimatedKm);
}

function totalMetric(session: PlannedSession): { value: string; color: string; caption: string } {
  const volume = structuredSessionVolume(session);
  const structureKm = structuredKm(volume);
  if (structureKm > 0) {
    return {
      value: `${structureKm}km`,
      color: C.metricDistance,
      caption: volume.structuredEstimatedKm > 0 ? 'estimated' : 'exact',
    };
  }
  if (volume.exactKm > 0) {
    return { value: `${volume.exactKm}km`, color: C.metricDistance, caption: 'exact' };
  }
  if (volume.estimatedKm > 0) {
    return { value: `${volume.estimatedKm}km`, color: C.metricDistance, caption: 'estimated' };
  }
  if (volume.plannedMinutes > 0) {
    return { value: `${volume.plannedMinutes}min`, color: C.metricTime, caption: 'planned' };
  }
  if (volume.structuredSeconds > 0) {
    const minutes = Math.round((volume.structuredSeconds / 60) * 10) / 10;
    return { value: `${minutes}min`, color: C.metricTime, caption: 'structured' };
  }
  return { value: '0', color: C.ink, caption: 'not set' };
}

function groupVolume(item: Extract<RunStructureItem, { kind: 'REPEAT' }>): string {
  const volume = { km: 0, seconds: 0 };
  item.segments.forEach((child) => addSegmentVolume(volume, child, item.repeats));
  return formatVolumeSummary(volume);
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

function typeChipLabel(type: SessionType): string {
  switch (type) {
    case 'INTERVAL':
      return 'Interval';
    case 'LONG':
      return 'Long';
    case 'TEMPO':
      return 'Tempo';
    case 'EASY':
    default:
      return 'Easy';
  }
}

function typeHeaderLabel(type: SessionType): string {
  switch (type) {
    case 'INTERVAL':
      return 'interval';
    case 'TEMPO':
      return 'tempo';
    case 'LONG':
      return 'long';
    case 'EASY':
    default:
      return 'easy';
  }
}

interface StructureDragHandleProps {
  testID: string;
  index: number;
  active: boolean;
  recordTouchStart: (pageY: number) => void;
  beginDrag: (index: number) => boolean;
  updateDrag: (pageY: number) => void;
  cancelDrag: () => void;
  finishDrag: () => DirectListReorderDragState | null;
  onFinish?: (dragState: DirectListReorderDragState | null) => void;
  onDragActiveChange?: (active: boolean) => void;
}

function StructureDragHandle({
  testID,
  index,
  active,
  recordTouchStart,
  beginDrag,
  updateDrag,
  cancelDrag,
  finishDrag,
  onFinish,
  onDragActiveChange,
}: StructureDragHandleProps) {
  function finish() {
    const dragState = finishDrag();
    onDragActiveChange?.(false);
    onFinish?.(dragState);
  }

  return (
    <DragHandle
      testID={testID}
      active={active}
      onMouseDown={(event) => {
        event.stopPropagation?.();
        onDragActiveChange?.(true);
        recordTouchStart(event.clientY);
        beginDrag(index);
      }}
      onMouseMove={(event) => {
        event.stopPropagation?.();
        updateDrag(event.clientY);
      }}
      onMouseUp={(event) => {
        event.stopPropagation?.();
        finish();
      }}
      onTouchStart={(event) => {
        event.stopPropagation?.();
        onDragActiveChange?.(true);
        recordTouchStart(event.nativeEvent.pageY);
      }}
      onLongPress={(event) => {
        recordTouchStart(event.nativeEvent.pageY);
        beginDrag(index);
      }}
      onTouchMove={(event) => {
        event.stopPropagation?.();
        updateDrag(event.nativeEvent.pageY);
      }}
      onTouchCancel={() => {
        cancelDrag();
        onDragActiveChange?.(false);
      }}
      onTouchEnd={() => {
        finish();
      }}
    />
  );
}

type RepeatStructureItem = Extract<RunStructureItem, { kind: 'REPEAT' }>;

interface RepeatGroupStructureCardProps {
  item: RepeatStructureItem;
  itemIndex: number;
  dragging: boolean;
  dragHandle: React.ReactNode;
  onSetRepeatCount: (itemIndex: number, repeats: number) => void;
  onRemoveItem: (itemIndex: number) => void;
  onSegmentsReordered: (itemIndex: number, segments: RunStructureSegment[]) => void;
  onDragActiveChange: (active: boolean) => void;
  renderSegment: (
    segmentValue: RunStructureSegment,
    itemIndex: number,
    segmentIndex: number | null,
    nested: boolean,
    dragHandle: React.ReactNode,
  ) => React.ReactNode;
}

function RepeatGroupStructureCard({
  item,
  itemIndex,
  dragging,
  dragHandle,
  onSetRepeatCount,
  onRemoveItem,
  onSegmentsReordered,
  onDragActiveChange,
  renderSegment,
}: RepeatGroupStructureCardProps) {
  const segmentOrder = useDirectListReorder<RunStructureSegment>({
    initialItems: item.segments,
    onReorder: (_fromIndex, _toIndex, nextSegments) => {
      onSegmentsReordered(itemIndex, nextSegments);
    },
  });

  return (
    <View style={[styles.repeatGroupCard, dragging && styles.structureItemDragging]}>
      <View style={styles.repeatHeader}>
        <View style={styles.repeatHeaderTitleRow}>
          {dragHandle}
          <View style={styles.repeatHeaderCopy}>
            <Text style={styles.itemTitle}>Repeat group</Text>
            <Text style={styles.itemCaption}>
              {item.repeats} rounds · {groupVolume(item)}
            </Text>
          </View>
        </View>
        <View style={styles.repeatHeaderActions}>
          <View style={styles.repeatStepper}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSetRepeatCount(itemIndex, item.repeats - 1)}
              style={styles.repeatStepButton}
            >
              <Text style={styles.repeatStepButtonText}>-</Text>
            </Pressable>
            <Text style={styles.repeatStepValue}>{item.repeats}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSetRepeatCount(itemIndex, item.repeats + 1)}
              style={styles.repeatStepButton}
            >
              <Text style={styles.repeatStepButtonText}>+</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onRemoveItem(itemIndex)}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.repeatSegments}>
        {segmentOrder.items.map((child, childIndex) => {
          const childDragging = segmentOrder.dragState?.fromIndex === childIndex;
          const childDropTarget =
            segmentOrder.dragState?.overIndex === childIndex
            && segmentOrder.dragState.fromIndex !== childIndex;

          return (
            <Animated.View
              key={`${itemIndex}-${childIndex}`}
              onLayout={(event) => {
                segmentOrder.registerSlotLayout(
                  childIndex,
                  event.nativeEvent.layout.y,
                  event.nativeEvent.layout.height,
                );
              }}
              style={[
                styles.structureItemWrap,
                childDragging && { transform: [{ translateY: segmentOrder.dragY }] },
              ]}
            >
              {childDropTarget ? (
                <View pointerEvents="none" style={styles.structureDropTargetOutline} />
              ) : null}
              {renderSegment(
                child,
                itemIndex,
                childIndex,
                true,
                <StructureDragHandle
                  testID={`run-structure-repeat-segment-drag-handle-${itemIndex}-${childIndex}`}
                  index={childIndex}
                  active={Boolean(childDragging)}
                  recordTouchStart={segmentOrder.recordTouchStart}
                  beginDrag={segmentOrder.beginDrag}
                  updateDrag={segmentOrder.updateDrag}
                  cancelDrag={segmentOrder.cancelDrag}
                  finishDrag={segmentOrder.finishDrag}
                  onDragActiveChange={onDragActiveChange}
                />,
              )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

export function RunStructureEditor({
  dayIndex,
  session,
  trainingPaceProfile = null,
  onSave,
  onClose,
  onChangeFormat,
}: RunStructureEditorProps) {
  const { units } = usePreferences();
  const initial = useMemo(() => createStructuredSessionDraft(session), [session]);
  const initialItems = useMemo(() => cloneRunStructureItems(initial.items), [initial]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>(() => initial.selectedTemplate);
  const [draftSession, setDraftSession] = useState<Partial<PlannedSession>>(initial.session);
  const [planNote, setPlanNote] = useState(initial.session.planNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [expandedSegmentKey, setExpandedSegmentKey] = useState<string | null>(null);
  const [customVolumeKey, setCustomVolumeKey] = useState<string | null>(null);
  const [customVolumeValue, setCustomVolumeValue] = useState('');
  const [customPaceKey, setCustomPaceKey] = useState<string | null>(null);
  const [customPaceValue, setCustomPaceValue] = useState('');
  const [isStructureDragActive, setIsStructureDragActive] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const structureOrder = useDirectListReorder<RunStructureItem>({
    initialItems,
    onReorder: () => {
      setSelectedTemplate('custom');
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    },
  });
  const items = structureOrder.items;
  const type = draftSession.type ?? session.type ?? 'EASY';
  const typeMeta = SESSION_TYPE[type];
  const availableTemplates = useMemo(
    () => getStructuredSessionTemplatesForType(type),
    [type],
  );
  const materialized = materializeStructuredSessionDraft({
    session: draftSession,
    items,
    planNote,
  });
  const summary = summariseRunStructure(materialized);
  const warning = structuredSessionMismatchWarning(materialized);
  const total = totalMetric(materialized);
  const quality = qualityVolume(items);
  const repeated = repeatsMetric(items);
  const simplePreview = convertStructuredSessionDraftToSimple({
    session: draftSession,
    items,
    planNote,
  });
  const simplePreviewDistance = simplePreview?.distance != null && simplePreview.distance > 0
    ? `${simplePreview.distance}km`
    : null;

  function applyTemplate(template: { key: TemplateKey }) {
    const next = applyStructuredSessionTemplate({
      templateKey: template.key,
      session: {
        ...draftSession,
        type,
        planNote,
      },
      trainingPaceProfile,
    });
    setSelectedTemplate(next.selectedTemplate);
    setDraftSession(next.session);
    structureOrder.replaceItems(next.items);
    setError(null);
    setExpandedSegmentKey(null);
    setCustomVolumeKey(null);
    setCustomPaceKey(null);
    setTemplatesExpanded(false);
  }

  function changeType(nextType: SessionType) {
    if (nextType === type || nextType === 'RECOVERY' || nextType === 'REST') {
      return;
    }

    setDraftSession((current) => ({
      ...current,
      type: nextType,
      format: 'structured',
      intensityTarget: current.intensityTarget ?? defaultIntensityTargetForSessionType(nextType),
    }));
    setSelectedTemplate('custom');
    setExpandedSegmentKey(null);
    setCustomVolumeKey(null);
    setCustomPaceKey(null);
  }

  function updateSegment(
    itemIndex: number,
    segmentIndex: number | null,
    updater: (segment: RunStructureSegment) => RunStructureSegment,
  ): boolean {
    let changed = false;

    structureOrder.updateItems((current) => current.map((item, index) => {
      if (index !== itemIndex) return item;
      if (item.kind === 'REPEAT') {
        let segmentChanged = false;
        const segments = item.segments.map((child, childIndex) => {
          if (childIndex !== segmentIndex) return child;
          const next = updater(child);
          if (next !== child) {
            segmentChanged = true;
          }
          return next;
        });
        if (!segmentChanged) return item;
        changed = true;
        return { ...item, segments };
      }

      if (segmentIndex != null) return item;
      const next = updater(item);
      if (next === item) return item;
      changed = true;
      return next;
    }));

    return changed;
  }

  function setRepeatCount(itemIndex: number, repeats: number) {
    let changed = false;
    structureOrder.updateItems((current) => current.map((item, index) => (
      index === itemIndex && item.kind === 'REPEAT'
        ? (() => {
            const nextRepeats = Math.max(1, Math.min(40, repeats));
            if (nextRepeats === item.repeats) return item;
            changed = true;
            return { ...item, repeats: nextRepeats };
          })()
        : item
    )));
    if (changed) {
      setSelectedTemplate('custom');
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    }
  }

  function addRunSegment() {
    structureOrder.updateItems((current) => [
      ...current,
      segment('RUN', { unit: 'km', value: 1 }, defaultIntensityTargetForSessionType(type)),
    ]);
    setSelectedTemplate('custom');
    setExpandedSegmentKey(null);
    setCustomPaceKey(null);
  }

  function groupLastTwoSegments() {
    let changed = false;
    structureOrder.updateItems((current) => {
      if (current.length < 2) return current;
      const last = current[current.length - 1];
      const previous = current[current.length - 2];
      if (last.kind === 'REPEAT' || previous.kind === 'REPEAT') return current;
      changed = true;
      return [
        ...current.slice(0, current.length - 2),
        repeat(2, [previous, last]),
      ];
    });
    if (changed) {
      setSelectedTemplate('custom');
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    }
  }

  function save() {
    const next = buildStructuredSessionSave({
      session: {
        ...draftSession,
        type,
      },
      items,
      planNote,
    });
    if (!next) {
      setError('Add at least one valid segment before saving.');
      return;
    }

    onSave(dayIndex, next);
  }

  function convertToSimple() {
    onChangeFormat?.('simple', simplePreview);
  }

  function removeItem(itemIndex: number) {
    structureOrder.updateItems((current) => current.filter((_, index) => index !== itemIndex));
    setSelectedTemplate('custom');
    setExpandedSegmentKey(null);
    setCustomVolumeKey(null);
    setCustomPaceKey(null);
  }

  function replaceRepeatSegments(itemIndex: number, segments: RunStructureSegment[]) {
    structureOrder.updateItems((current) => current.map((item, index) => (
      index === itemIndex && item.kind === 'REPEAT'
        ? { ...item, segments }
        : item
    )));
    setSelectedTemplate('custom');
    setExpandedSegmentKey(null);
    setCustomVolumeKey(null);
    setCustomPaceKey(null);
  }

  function segmentEditorKey(itemIndex: number, segmentIndex: number | null): string {
    return `${itemIndex}:${segmentIndex ?? 'single'}`;
  }

  function updateSegmentVolume(
    itemIndex: number,
    segmentIndex: number | null,
    volume: RunStructureVolume,
  ) {
    const changed = updateSegment(itemIndex, segmentIndex, (current) => (
      volumesMatch(current.volume, volume) ? current : { ...current, volume }
    ));
    if (changed) {
      setSelectedTemplate('custom');
    }
  }

  function updateSegmentIntensityTarget(
    itemIndex: number,
    segmentIndex: number | null,
    intensityTarget: IntensityTarget | undefined,
  ) {
    const changed = updateSegment(itemIndex, segmentIndex, (current) => (
      intensityTargetsMatch(current.intensityTarget, intensityTarget) && current.progression == null
        ? current
        : {
            ...current,
            intensityTarget,
            progression: undefined,
          }
    ));
    if (changed) {
      setSelectedTemplate('custom');
    }
  }

  function renderSegmentEditor(
    segmentValue: RunStructureSegment,
    itemIndex: number,
    segmentIndex: number | null,
    key: string,
  ) {
    const customEditing = customVolumeKey === key;
    const paceEditing = customPaceKey === key;
    const metricColor = volumeMetricColor(segmentValue.volume.unit);
    const selectedPaceKey = selectedSegmentPaceKey(segmentValue);
    const representativeTargetPace = targetRepresentativePace(
      segmentValue.intensityTarget,
      draftSession.pace ?? session.pace ?? '4:30',
    ) ?? '4:30';
    const trainingOptions = segmentPaceOptions(type, segmentValue, trainingPaceProfile, units);
    const trainingOptionKeys = new Set(trainingOptions.map((option) => option.key));
    const customPaceOptions = pacePresets(representativeTargetPace).map((preset) => ({
      key: preset,
      label: `${preset} /km`,
    }));
    const customPaceOptionKeys = new Set(customPaceOptions.map((option) => option.key));
    const canEditTargetPace = segmentValue.kind !== 'REST';

    return (
      <View style={styles.segmentEditor}>
        <View style={styles.segmentEditorGroup}>
          <Text style={styles.segmentEditorLabel}>Segment type</Text>
          <ChipRow
            chips={SEGMENT_KINDS.map((kind) => ({
              key: kind,
              label: segmentKindLabel(kind),
              color: typeMeta.color,
            }))}
            selected={segmentValue.kind}
            onSelect={(kind) => {
              const nextKind = kind as RunStructureSegmentKind;
              const changed = updateSegment(itemIndex, segmentIndex, (current) => (
                current.kind === nextKind ? current : { ...current, kind: nextKind }
              ));
              if (changed) {
                setSelectedTemplate('custom');
              }
            }}
          />
        </View>

        {canEditTargetPace ? (
          <View style={styles.segmentEditorGroup}>
            <Text style={styles.segmentEditorLabel}>Target pace</Text>
            <EditableChipStrip
              options={customPaceOptions}
              optionGroups={[
                ...(trainingOptions.length > 0
                  ? [{ label: 'Training paces', options: trainingOptions }]
                  : []),
                { label: 'Custom', options: customPaceOptions, includeCustom: true },
              ]}
              selectedKey={selectedPaceKey}
              activeColor={C.metricPace}
              activeBackgroundColor={C.metricPaceBg}
              activeTextColor={C.metricPace}
              activeCaptionColor={C.ink2}
              inactiveTextColor={C.metricPace}
              customActive={Boolean(
                selectedPaceKey
                && !trainingOptionKeys.has(selectedPaceKey)
                && !customPaceOptionKeys.has(selectedPaceKey),
              )}
              customEditing={paceEditing}
              customLabel="Custom pace..."
              customValue={paceEditing ? customPaceValue : ''}
              customUnit="/km"
              customKeyboardType="numbers-and-punctuation"
              onSelect={(value) => {
                if (trainingOptionKeys.has(value)) {
                  updateSegmentIntensityTarget(
                    itemIndex,
                    segmentIndex,
                    targetForProfileKey(trainingPaceProfile, value as TrainingPaceProfileKey),
                  );
                  setCustomPaceKey(null);
                  return;
                }

                const target = manualPaceIntensityTarget(value);
                if (target) {
                  updateSegmentIntensityTarget(itemIndex, segmentIndex, target);
                }
                setCustomPaceKey(null);
              }}
              onCustomPress={() => {
                setCustomPaceKey(key);
                setCustomPaceValue(representativeTargetPace);
              }}
              onCustomChangeText={(value) => {
                setCustomPaceValue(value);
                const normalized = normalizeCustomPace(value);
                if (!normalized) return;
                updateSegmentIntensityTarget(
                  itemIndex,
                  segmentIndex,
                  manualPaceIntensityTarget(normalized),
                );
              }}
              onCustomBlur={() => setCustomPaceKey(null)}
            />
          </View>
        ) : null}

        <View style={styles.segmentEditorGroup}>
          <View style={styles.segmentEditorHeader}>
            <Text style={styles.segmentEditorLabel}>Volume</Text>
            <UnitTogglePill
              value={segmentValue.volume.unit}
              options={VOLUME_UNITS}
              onChange={(unit) => updateSegmentVolume(itemIndex, segmentIndex, {
                unit,
                value: segmentValue.volume.value,
              })}
            />
          </View>
          <ChipStripEditor
            presets={volumePresets(segmentValue.volume.unit)}
            unit={segmentValue.volume.unit}
            value={segmentValue.volume.value}
            activeColor={metricColor}
            activeTextColor={metricColor}
            inactiveTextColor={metricColor}
            customEditing={customEditing}
            customValue={customEditing ? customVolumeValue : ''}
            onSelect={(value) => {
              updateSegmentVolume(itemIndex, segmentIndex, {
                ...segmentValue.volume,
                value,
              });
              setCustomVolumeKey(null);
            }}
            onCustomPress={() => {
              setCustomVolumeKey(key);
              setCustomVolumeValue(String(segmentValue.volume.value));
            }}
            onCustomChangeText={(value) => {
              setCustomVolumeValue(value);
              const parsed = parsePositiveNumber(value);
              if (parsed == null) return;
              updateSegmentVolume(itemIndex, segmentIndex, {
                ...segmentValue.volume,
                value: parsed,
              });
            }}
            onCustomBlur={() => setCustomVolumeKey(null)}
          />
        </View>
      </View>
    );
  }

  function renderSegment(
    segmentValue: RunStructureSegment,
    itemIndex: number,
    segmentIndex: number | null,
    nested = false,
    dragHandle?: React.ReactNode,
  ) {
    const key = segmentEditorKey(itemIndex, segmentIndex);
    const expanded = expandedSegmentKey === key;
    const metricColor = volumeMetricColor(segmentValue.volume.unit);

    return (
      <View
        style={[styles.segmentCard, nested && styles.segmentCardNested]}
        key={`${itemIndex}-${segmentIndex ?? 'single'}`}
      >
        <Pressable
          testID={`run-structure-segment-${itemIndex}-${segmentIndex ?? 'single'}`}
          accessibilityRole="button"
          onPress={() => {
            setExpandedSegmentKey(expanded ? null : key);
            setCustomVolumeKey(null);
            setCustomPaceKey(null);
          }}
          style={styles.segmentSummary}
        >
          {dragHandle}
          <View style={styles.segmentCopy}>
            <Text style={styles.segmentTitle}>{segmentKindLabel(segmentValue.kind)}</Text>
            <Text style={styles.segmentCaption}>{segmentIntensityLabel(segmentValue, units)}</Text>
          </View>
          <Text style={[styles.segmentVolume, { color: metricColor }]}>
            {formatVolume(segmentValue.volume)}
          </Text>
        </Pressable>
        {expanded ? renderSegmentEditor(segmentValue, itemIndex, segmentIndex, key) : null}
      </View>
    );
  }

  const canGroupLastTwo = items.length >= 2
    && items[items.length - 1].kind !== 'REPEAT'
    && items[items.length - 2].kind !== 'REPEAT';
  const headerTitle = `${total.value} ${typeHeaderLabel(type)} · Structured`;

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
          <Text style={styles.closeButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerDay}>{FULL_DAYS[dayIndex]}</Text>
        <Text style={[styles.title, { color: typeMeta.color }]}>{headerTitle}</Text>
      </View>

      <ScrollView
        testID={isStructureDragActive ? 'run-structure-scroll-locked' : 'run-structure-scroll'}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        scrollEnabled={!isStructureDragActive}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <SectionLabel>Session type</SectionLabel>
          <ChipRow
            chips={STRUCTURED_SESSION_TYPES.map((sessionType) => ({
              key: sessionType,
              label: typeChipLabel(sessionType),
              color: SESSION_TYPE[sessionType].color,
            }))}
            selected={type}
            onSelect={(nextType) => changeType(nextType as SessionType)}
          />
        </View>

        <View style={styles.section}>
          <SectionLabel>Format</SectionLabel>
          <ChipRow
            chips={[
              { key: 'simple', label: 'Simple', color: typeMeta.color },
              { key: 'structured', label: 'Structured', color: typeMeta.color },
            ]}
            selected="structured"
            onSelect={(nextFormat) => {
              if (nextFormat === 'simple') {
                setShowConvertConfirm(true);
              }
            }}
          />
          {showConvertConfirm ? (
            <View style={styles.convertCard}>
              <Text style={styles.convertTitle}>Use simple run?</Text>
              <Text style={styles.convertCopy}>
                This will remove the detailed structure and keep the total distance as one run.
              </Text>
              <View style={styles.convertPreview}>
                <Text style={styles.convertPreviewText}>
                  Type: {SESSION_TYPE[type].label}
                </Text>
                <Text style={styles.convertPreviewText}>
                  Distance: {simplePreviewDistance ?? 'current distance'} from structure
                </Text>
              </View>
              <View style={styles.convertActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowConvertConfirm(false)}
                  style={styles.convertSecondaryAction}
                >
                  <Text style={styles.convertSecondaryText}>Keep structured</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={convertToSimple}
                  style={styles.convertPrimaryAction}
                >
                  <Text style={styles.convertPrimaryText}>Use simple run</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionLabel>Templates</SectionLabel>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTemplatesExpanded((current) => !current)}
            style={({ pressed }) => [styles.templateSummaryCard, pressed && styles.templatePressed]}
          >
            <View style={styles.templateSummaryCopy}>
              <Text style={styles.templateTitle}>Starting structures</Text>
              <Text style={styles.templateCaption}>Choose a starting structure.</Text>
            </View>
            <Text style={[styles.templateToggle, { color: typeMeta.color }]}>
              {templatesExpanded ? 'Hide' : 'Change'}
            </Text>
          </Pressable>
          {templatesExpanded ? (
            <View style={styles.templateGrid}>
              {availableTemplates.map((template) => {
                const active = selectedTemplate === template.key;
                return (
                  <Pressable
                    key={template.key}
                    testID={`run-structure-template-${template.key}`}
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
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionLabel>Run structure</SectionLabel>
          <View style={styles.summaryCards}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Adds up to</Text>
              <Text style={[styles.summaryValue, { color: total.color }]}>{total.value}</Text>
              <Text style={styles.summaryCaption}>{total.caption}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Quality</Text>
              <Text style={[styles.summaryValue, { color: quality.km > 0 ? C.metricDistance : C.metricTime }]}>
                {formatVolumeSummary(quality)}
              </Text>
              <Text style={styles.summaryCaption}>structured</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Repeats</Text>
              <Text style={styles.summaryValue}>{repeated.value}</Text>
              <Text style={styles.summaryCaption}>{repeated.caption}</Text>
            </View>
          </View>
          {summary ? <Text style={styles.structureSummaryLine}>{summary}</Text> : null}
          {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.itemsList}>
            {items.map((item, itemIndex) => {
              const dragging = structureOrder.dragState?.fromIndex === itemIndex;
              const dropTarget =
                structureOrder.dragState?.overIndex === itemIndex
                && structureOrder.dragState.fromIndex !== itemIndex;
              const dragHandle = (
                <StructureDragHandle
                  testID={`run-structure-drag-handle-${itemIndex}`}
                  index={itemIndex}
                  active={Boolean(dragging)}
                  recordTouchStart={structureOrder.recordTouchStart}
                  beginDrag={structureOrder.beginDrag}
                  updateDrag={structureOrder.updateDrag}
                  cancelDrag={structureOrder.cancelDrag}
                  finishDrag={structureOrder.finishDrag}
                  onDragActiveChange={setIsStructureDragActive}
                />
              );

              return (
                <Animated.View
                  key={`${item.kind}-${itemIndex}`}
                  onLayout={(event) => {
                    structureOrder.registerSlotLayout(
                      itemIndex,
                      event.nativeEvent.layout.y,
                      event.nativeEvent.layout.height,
                    );
                  }}
                  style={[
                    styles.structureItemWrap,
                    dragging && { transform: [{ translateY: structureOrder.dragY }] },
                  ]}
                >
                  {dropTarget ? (
                    <View pointerEvents="none" style={styles.structureDropTargetOutline} />
                  ) : null}
                  {item.kind === 'REPEAT' ? (
                    <RepeatGroupStructureCard
                      item={item}
                      itemIndex={itemIndex}
                      dragging={Boolean(dragging)}
                      dragHandle={dragHandle}
                      onSetRepeatCount={setRepeatCount}
                      onRemoveItem={removeItem}
                      onSegmentsReordered={replaceRepeatSegments}
                      onDragActiveChange={setIsStructureDragActive}
                      renderSegment={renderSegment}
                    />
                  ) : (
                    <View style={[styles.itemShell, dragging && styles.structureItemDragging]}>
                      {renderSegment(item, itemIndex, null, false, dragHandle)}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => removeItem(itemIndex)}
                        style={styles.removeInlineButton}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.addPanel}>
            <Btn title="Add segment" variant="secondary" onPress={addRunSegment} />
            <Text style={styles.addHint}>
              Add segments first. Group adjacent segments when they should repeat together.
            </Text>
            {canGroupLastTwo ? (
              <Pressable
                accessibilityRole="button"
                onPress={groupLastTwoSegments}
                style={styles.groupButton}
              >
                <Text style={[styles.groupButtonText, { color: typeMeta.color }]}>
                  Group last 2 segments
                </Text>
              </Pressable>
            ) : null}
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

      </ScrollView>

      <View style={styles.actions}>
        <Btn title="Update session" fullWidth onPress={save} />
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
  headerDay: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
    marginBottom: 6,
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
    marginTop: 8,
    gap: 8,
  },
  templateSummaryCard: {
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  templatePressed: {
    opacity: 0.82,
  },
  templateSummaryCopy: {
    flex: 1,
    gap: 4,
  },
  templateToggle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
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
  summaryCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: C.muted,
  },
  summaryValue: {
    marginTop: 7,
    fontFamily: FONTS.monoBold,
    fontSize: 15,
    lineHeight: 19,
    color: C.ink,
  },
  summaryCaption: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  structureSummaryLine: {
    marginBottom: 10,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: C.ink2,
  },
  warningText: {
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${C.statusConnected}25`,
    backgroundColor: C.statusConnectedBg,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.statusConnected,
  },
  errorText: {
    marginBottom: 10,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: C.clay,
  },
  itemsList: {
    gap: 10,
  },
  structureItemWrap: {
    position: 'relative',
  },
  structureItemDragging: {
    opacity: 0.94,
  },
  structureDropTargetOutline: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    zIndex: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.metricDistance,
    backgroundColor: `${C.metricDistance}08`,
  },
  itemShell: {
    gap: 6,
  },
  repeatGroupCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.card,
    padding: 12,
    gap: 10,
  },
  repeatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  repeatHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repeatHeaderCopy: {
    flex: 1,
  },
  repeatHeaderActions: {
    alignItems: 'flex-end',
    gap: 6,
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
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  removeInlineButton: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  removeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.clay,
  },
  repeatStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  repeatStepButton: {
    width: 27,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatStepButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
  },
  repeatStepValue: {
    minWidth: 22,
    textAlign: 'center',
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.ink,
  },
  repeatSegments: {
    gap: 8,
  },
  segmentCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  segmentCardNested: {
    backgroundColor: C.surface,
  },
  segmentSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 11,
  },
  segmentCopy: {
    flex: 1,
    gap: 3,
  },
  segmentTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
    color: C.ink,
  },
  segmentCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: C.muted,
  },
  segmentVolume: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink2,
  },
  segmentEditor: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 12,
  },
  segmentEditorGroup: {
    gap: 8,
  },
  segmentEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  segmentEditorLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: C.muted,
  },
  addPanel: {
    marginTop: 12,
    gap: 8,
  },
  addHint: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.muted,
  },
  groupButton: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  groupButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
  },
  convertLink: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  convertLinkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  convertCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: `${C.clay}30`,
    borderRadius: 12,
    backgroundColor: C.surface,
    padding: 13,
    gap: 9,
  },
  convertTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  convertCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  convertPreview: {
    gap: 4,
    paddingTop: 2,
  },
  convertPreviewText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.ink2,
  },
  convertActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 2,
  },
  convertSecondaryAction: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  convertSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  convertPrimaryAction: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.clay,
  },
  convertPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.surface,
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
