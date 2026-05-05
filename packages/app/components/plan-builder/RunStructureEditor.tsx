import React, { useMemo, useState } from 'react';
import {
  Animated,
  Easing,
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
  type DirectListReorderExtractDirection,
  type DirectListReorderDragState,
} from '../../features/plan-builder/use-direct-list-reorder';
import {
  applyStructuredSessionTemplate,
  buildSimpleSessionForUnsupportedStructuredFormat,
  buildStructuredSessionSave,
  cloneRunStructureItems,
  convertStructuredSessionDraftToSimple,
  createStructuredSessionDraft,
  getStructuredSessionTemplatesForType,
  materializeStructuredSessionDraft,
  runStructureRepeat as repeat,
  runStructureSegment as segment,
  sessionTypeSupportsStructuredFormat,
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
import { SessionTypeCardGrid } from './SessionTypeCardGrid';

interface RunStructureEditorProps {
  dayIndex: number;
  session: Partial<PlannedSession>;
  trainingPaceProfile?: TrainingPaceProfile | null;
  onSave: (dayIndex: number, session: Partial<PlannedSession>) => void;
  onClose: () => void;
  onChangeFormat?: (
    format: SessionFormat,
    session: Partial<PlannedSession>,
    context?: {
      restoreStructuredDraft?: Partial<PlannedSession>;
      pendingStructureClear?: boolean;
      pendingStructureClearReason?: StructureClearReason;
    },
  ) => void;
}

type StructureClearReason = 'simple' | 'recovery' | 'rest';
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
const STRUCTURED_EDITOR_SESSION_TYPES: SessionType[] = [
  'EASY',
  'RECOVERY',
  'INTERVAL',
  'TEMPO',
  'LONG',
  'REST',
];
const LONG_PRESS_DRAG_DELAY_MS = 360;
const GESTURE_INTENT_SLOP = 8;
const SWIPE_DELETE_THRESHOLD = 118;
const SWIPE_ACTION_LABEL_WIDTH = 112;
const NESTED_EXTRACT_SLOT_HEIGHT = 76;
const NESTED_EXTRACT_AFTER_GAP = 8;
const NESTED_EXTRACT_BEFORE_GAP = 26;
const STRUCTURE_PREVIEW_ANIMATION_MS = 130;
const NESTED_EXTRACT_ANIMATION_MS = 155;
const USE_STRUCTURE_MOTION = Platform.OS !== 'web' && typeof globalThis.document === 'undefined';
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function animateStructureTop(value: Animated.Value, toValue: number, duration: number) {
  value.stopAnimation();
  if (!USE_STRUCTURE_MOTION) {
    value.setValue(toValue);
    return;
  }

  Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  }).start();
}

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

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function structuredKm(volume: ReturnType<typeof structuredSessionVolume>): number {
  return roundKm(volume.structuredExactKm + volume.structuredEstimatedKm);
}

function distanceMetric(session: PlannedSession): { value: string; color: string; caption: string } {
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
  return { value: '-', color: C.metricDistance, caption: 'no distance' };
}

function timeMetric(session: PlannedSession): { value: string; color: string; caption: string } {
  const volume = structuredSessionVolume(session);
  if (volume.structuredSeconds > 0) {
    const minutes = Math.round((volume.structuredSeconds / 60) * 10) / 10;
    return { value: `${minutes}min`, color: C.metricTime, caption: 'structured' };
  }
  if (volume.plannedMinutes > 0) {
    return { value: `${volume.plannedMinutes}min`, color: C.metricTime, caption: 'planned' };
  }
  return { value: '-', color: C.metricTime, caption: 'from pace' };
}

function qualityMetric(
  items: RunStructureItem[],
  session: PlannedSession,
): { value: string; color: string; caption: string } {
  const quality = qualityVolume(items);
  const volume = structuredSessionVolume(session);
  const totalKm = volume.structuredExactKm + volume.structuredEstimatedKm;

  if (quality.km > 0 && totalKm > 0) {
    return {
      value: `${Math.round((quality.km / totalKm) * 100)}%`,
      color: C.metricEffort,
      caption: 'of session',
    };
  }

  if (quality.seconds > 0 && volume.structuredSeconds > 0) {
    return {
      value: `${Math.round((quality.seconds / volume.structuredSeconds) * 100)}%`,
      color: C.metricEffort,
      caption: 'of session',
    };
  }

  return { value: '0%', color: C.metricEffort, caption: 'of session' };
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

interface StructureDragControls {
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

interface FormatSegmentedControlProps {
  onSimplePress: () => void;
}

function FormatSegmentedControl({ onSimplePress }: FormatSegmentedControlProps) {
  return (
    <View style={styles.formatSegmentedControl}>
      <Pressable
        accessibilityRole="button"
        onPress={onSimplePress}
        style={({ pressed }) => [
          styles.formatSegment,
          pressed && styles.formatSegmentPressed,
        ]}
      >
        <Text style={styles.formatSegmentText}>Simple</Text>
      </Pressable>
      <View style={[styles.formatSegment, styles.formatSegmentActive]}>
        <Text style={[styles.formatSegmentText, styles.formatSegmentTextActive]}>
          Structured
        </Text>
      </View>
    </View>
  );
}

interface MetricSummaryCardsProps {
  distance: { value: string; color: string; caption: string };
  time: { value: string; color: string; caption: string };
  quality: { value: string; color: string; caption: string };
}

function MetricSummaryCards({ distance, time, quality }: MetricSummaryCardsProps) {
  const cards = [
    { label: 'Distance', metric: distance },
    { label: 'Time', metric: time },
    { label: 'Quality', metric: quality },
  ];

  return (
    <View style={styles.summaryCards}>
      {cards.map(({ label, metric }) => (
        <View key={label} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{label}</Text>
          <Text style={[styles.summaryValue, { color: metric.color }]}>{metric.value}</Text>
          <Text style={styles.summaryCaption}>{metric.caption}</Text>
        </View>
      ))}
    </View>
  );
}

interface ReorderableStructureItemProps {
  itemKey: string;
  testID: string;
  dragging: boolean;
  elevated?: boolean;
  extracting?: boolean;
  extractDirection?: DirectListReorderExtractDirection | null;
  extractAfterTop?: number | null;
  extractBeforeGap?: number;
  dragY: Animated.Value;
  dragOffset?: number;
  previewOffset: number;
  onLayout: (event: Parameters<NonNullable<React.ComponentProps<typeof Animated.View>['onLayout']>>[0]) => void;
  children: React.ReactNode;
}

function ReorderableStructureItem({
  itemKey,
  testID,
  dragging,
  elevated = false,
  extracting = false,
  extractDirection = null,
  extractAfterTop = null,
  extractBeforeGap = NESTED_EXTRACT_BEFORE_GAP,
  dragY,
  dragOffset = 0,
  previewOffset,
  onLayout,
  children,
}: ReorderableStructureItemProps) {
  const [layoutY, setLayoutY] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const previewTop = React.useRef(new Animated.Value(previewOffset)).current;
  const extractionTop = React.useRef(new Animated.Value(0)).current;
  const extractingRef = React.useRef(false);
  const extractionTargetRef = React.useRef<number | null>(null);
  const extractingDrag = dragging && extracting;
  const extractTop = (() => {
    if (!extractingDrag) return null;
    if (extractDirection === 'after' && extractAfterTop != null) {
      return extractAfterTop;
    }
    if (extractDirection === 'before' && layoutHeight > 0) {
      return -extractBeforeGap - layoutHeight;
    }
    return layoutY + dragOffset;
  })();

  React.useLayoutEffect(() => {
    if (dragging || extractingDrag) {
      previewTop.stopAnimation();
      previewTop.setValue(previewOffset);
      return;
    }

    animateStructureTop(previewTop, previewOffset, STRUCTURE_PREVIEW_ANIMATION_MS);
  }, [dragging, extractingDrag, previewOffset, previewTop]);

  React.useLayoutEffect(() => {
    if (!extractingDrag || extractTop == null) {
      extractionTop.stopAnimation();
      extractingRef.current = false;
      extractionTargetRef.current = null;
      return;
    }

    if (!extractingRef.current) {
      extractionTop.stopAnimation();
      extractionTop.setValue(layoutY + dragOffset);
      extractingRef.current = true;
      extractionTargetRef.current = null;
    }

    if (extractionTargetRef.current === extractTop) {
      return;
    }

    extractionTargetRef.current = extractTop;
    animateStructureTop(extractionTop, extractTop, NESTED_EXTRACT_ANIMATION_MS);
  }, [dragOffset, extractTop, extractingDrag, extractionTop, layoutY]);

  function handleLayout(
    event: Parameters<NonNullable<React.ComponentProps<typeof Animated.View>['onLayout']>>[0],
  ) {
    if (!dragging) {
      const nextY = event.nativeEvent.layout.y;
      const nextHeight = event.nativeEvent.layout.height;
      setLayoutY((current) => (Math.abs(current - nextY) > 0.5 ? nextY : current));
      setLayoutHeight((current) => (Math.abs(current - nextHeight) > 0.5 ? nextHeight : current));
    }
    onLayout(event);
  }

  return (
    <Animated.View
      key={itemKey}
      testID={testID}
      onLayout={handleLayout}
      style={[
        styles.structureItemWrap,
        extractingDrag && styles.structureItemWrapExtracting,
        (dragging || elevated) && styles.structureItemWrapDragging,
        extractingDrag
          ? { top: USE_STRUCTURE_MOTION ? extractionTop : extractTop ?? layoutY + dragOffset }
          : { top: dragging ? dragY : USE_STRUCTURE_MOTION ? previewTop : previewOffset },
        {
          transform: [
            { scale: dragging ? 1.015 : 1 },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface SwipeDeleteSegmentProps {
  testID: string;
  disabled?: boolean;
  overflowVisible?: boolean;
  dragControls?: StructureDragControls;
  onSwipeActiveChange?: (active: boolean) => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function SwipeDeleteSegment({
  testID,
  disabled = false,
  overflowVisible = false,
  dragControls,
  onSwipeActiveChange,
  onDelete,
  children,
}: SwipeDeleteSegmentProps) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const deleteLabelTranslateX = React.useRef(new Animated.Value(SWIPE_ACTION_LABEL_WIDTH / 2)).current;
  const startXRef = React.useRef<number | null>(null);
  const startYRef = React.useRef<number | null>(null);
  const latestYRef = React.useRef<number | null>(null);
  const currentXRef = React.useRef(0);
  const swipingRef = React.useRef(false);
  const swipingActiveRef = React.useRef(false);
  const draggingRef = React.useRef(false);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = React.useRef(false);
  const [armed, setArmed] = React.useState(false);

  function pageXFromEvent(event: unknown): number | null {
    const candidate = event as {
      clientX?: unknown;
      nativeEvent?: { pageX?: unknown; clientX?: unknown };
    };
    if (typeof candidate.clientX === 'number') return candidate.clientX;
    if (typeof candidate.nativeEvent?.pageX === 'number') return candidate.nativeEvent.pageX;
    if (typeof candidate.nativeEvent?.clientX === 'number') return candidate.nativeEvent.clientX;
    return null;
  }

  function pageYFromEvent(event: unknown): number | null {
    const candidate = event as {
      clientY?: unknown;
      nativeEvent?: { pageY?: unknown; clientY?: unknown };
    };
    if (typeof candidate.clientY === 'number') return candidate.clientY;
    if (typeof candidate.nativeEvent?.pageY === 'number') return candidate.nativeEvent.pageY;
    if (typeof candidate.nativeEvent?.clientY === 'number') return candidate.nativeEvent.clientY;
    return null;
  }

  function stopEvent(event: unknown) {
    (event as { stopPropagation?: () => void }).stopPropagation?.();
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function setArmedValue(nextArmed: boolean) {
    if (armedRef.current === nextArmed) return;
    armedRef.current = nextArmed;
    setArmed(nextArmed);
  }

  function setSwipeActive(nextActive: boolean) {
    if (swipingActiveRef.current === nextActive) return;
    swipingActiveRef.current = nextActive;
    onSwipeActiveChange?.(nextActive);
  }

  function resetGestureState() {
    clearLongPressTimer();
    startXRef.current = null;
    startYRef.current = null;
    latestYRef.current = null;
    currentXRef.current = 0;
    swipingRef.current = false;
    draggingRef.current = false;
  }

  function startDrag(pageY: number | null) {
    if (!dragControls || swipingRef.current || draggingRef.current) return;
    clearLongPressTimer();
    const activationY = pageY ?? latestYRef.current ?? startYRef.current ?? 0;
    draggingRef.current = true;
    dragControls.onDragActiveChange?.(true);
    dragControls.recordTouchStart(activationY);
    dragControls.beginDrag(dragControls.index);
  }

  function startGesture(event: unknown) {
    stopEvent(event);
    const pageX = pageXFromEvent(event);
    const pageY = pageYFromEvent(event);
    if (pageX == null && pageY == null) return;
    startXRef.current = pageX;
    startYRef.current = pageY;
    latestYRef.current = pageY;
    currentXRef.current = 0;
    swipingRef.current = false;
    draggingRef.current = false;
    setArmedValue(false);
    translateX.setValue(0);
    deleteLabelTranslateX.setValue(SWIPE_ACTION_LABEL_WIDTH / 2);

    if (dragControls && pageY != null) {
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        startDrag(latestYRef.current);
      }, LONG_PRESS_DRAG_DELAY_MS);
    }
  }

  function updateGesture(event: unknown) {
    if (startXRef.current == null && startYRef.current == null) return;
    stopEvent(event);
    const pageX = pageXFromEvent(event);
    const pageY = pageYFromEvent(event);
    if (pageY != null) {
      latestYRef.current = pageY;
    }

    if (draggingRef.current) {
      if (pageY != null) {
        dragControls?.updateDrag(pageY);
      }
      return;
    }

    const dx = pageX != null && startXRef.current != null ? pageX - startXRef.current : 0;
    const dy = pageY != null && startYRef.current != null ? pageY - startYRef.current : 0;
    const horizontalIntent = dx < -GESTURE_INTENT_SLOP && Math.abs(dx) > Math.abs(dy);

    if (horizontalIntent && !disabled) {
      clearLongPressTimer();
      setSwipeActive(true);
      swipingRef.current = true;
    } else if (
      !swipingRef.current
      && (Math.abs(dx) > GESTURE_INTENT_SLOP || Math.abs(dy) > GESTURE_INTENT_SLOP)
    ) {
      clearLongPressTimer();
    }

    if (!swipingRef.current || disabled) {
      return;
    }

    const nextX = Math.min(0, dx);
    currentXRef.current = nextX;
    translateX.setValue(nextX);
    deleteLabelTranslateX.setValue((nextX + SWIPE_ACTION_LABEL_WIDTH) / 2);
    setArmedValue(nextX <= -SWIPE_DELETE_THRESHOLD);
  }

  function finishGesture() {
    clearLongPressTimer();

    if (draggingRef.current) {
      const dragState = dragControls?.finishDrag() ?? null;
      dragControls?.onDragActiveChange?.(false);
      dragControls?.onFinish?.(dragState);
      resetGestureState();
      return;
    }

    if (disabled || !swipingRef.current || startXRef.current == null) {
      setSwipeActive(false);
      resetGestureState();
      return;
    }

    const shouldDelete = currentXRef.current <= -SWIPE_DELETE_THRESHOLD;

    if (shouldDelete) {
      Animated.timing(translateX, {
        toValue: currentXRef.current,
        duration: 90,
        useNativeDriver: true,
      }).start(() => {
        translateX.setValue(0);
        deleteLabelTranslateX.setValue(SWIPE_ACTION_LABEL_WIDTH / 2);
        setArmedValue(false);
        setSwipeActive(false);
        resetGestureState();
        onDelete();
      });
      return;
    }

    Animated.timing(translateX, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
    Animated.timing(deleteLabelTranslateX, {
      toValue: SWIPE_ACTION_LABEL_WIDTH / 2,
      duration: 150,
      useNativeDriver: true,
    }).start();
    setArmedValue(false);
    setSwipeActive(false);
    resetGestureState();
  }

  function cancelGesture() {
    clearLongPressTimer();

    if (draggingRef.current) {
      dragControls?.cancelDrag();
      dragControls?.onDragActiveChange?.(false);
    }

    translateX.setValue(0);
    deleteLabelTranslateX.setValue(SWIPE_ACTION_LABEL_WIDTH / 2);
    setArmedValue(false);
    setSwipeActive(false);
    resetGestureState();
  }

  return (
    <View
      testID={testID}
      style={[
        styles.swipeDeleteShell,
        overflowVisible && styles.swipeDeleteShellOverflowVisible,
      ]}
      onTouchStart={startGesture}
      onTouchMove={updateGesture}
      onTouchCancel={cancelGesture}
      onTouchEnd={finishGesture}
      {...({
        onMouseDown: startGesture,
        onMouseMove: updateGesture,
        onMouseUp: (event: unknown) => {
          stopEvent(event);
          finishGesture();
        },
        onMouseLeave: (event: unknown) => {
          stopEvent(event);
          finishGesture();
        },
      } as object)}
    >
      <Animated.View
        testID={`${testID}-action-${armed ? 'armed' : 'idle'}`}
        pointerEvents="none"
        style={[
          styles.swipeDeleteAction,
          armed && styles.swipeDeleteActionArmed,
        ]}
      >
        <Animated.View
          style={[
            styles.swipeDeleteTextWrap,
            { transform: [{ translateX: deleteLabelTranslateX }] },
          ]}
        >
          <Text style={[styles.swipeDeleteText, armed && styles.swipeDeleteTextArmed]}>
            Delete
          </Text>
        </Animated.View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

type RepeatStructureItem = Extract<RunStructureItem, { kind: 'REPEAT' }>;

interface RepeatGroupStructureCardProps {
  item: RepeatStructureItem;
  itemIndex: number;
  dragging: boolean;
  collapsed: boolean;
  onSetRepeatCount: (itemIndex: number, repeats: number) => void;
  onToggleCollapsed: (itemIndex: number) => void;
  onSegmentsReordered: (itemIndex: number, segments: RunStructureSegment[]) => void;
  onRemoveSegment: (itemIndex: number, segmentIndex: number) => void;
  onSegmentExtracted: (
    itemIndex: number,
    segmentIndex: number,
    direction: DirectListReorderExtractDirection,
    nextSegments: RunStructureSegment[],
    segmentValue: RunStructureSegment,
  ) => void;
  onNestedExtractionChange: (
    itemIndex: number,
    direction: DirectListReorderExtractDirection | null,
  ) => void;
  onDragActiveChange: (active: boolean) => void;
  renderSegment: (
    segmentValue: RunStructureSegment,
    itemIndex: number,
    segmentIndex: number | null,
    nested: boolean,
    dragControls: StructureDragControls,
    onDelete?: () => void,
    standalonePreview?: boolean,
  ) => React.ReactNode;
}

function RepeatGroupStructureCard({
  item,
  itemIndex,
  dragging,
  collapsed,
  onSetRepeatCount,
  onToggleCollapsed,
  onSegmentsReordered,
  onRemoveSegment,
  onSegmentExtracted,
  onNestedExtractionChange,
  onDragActiveChange,
  renderSegment,
}: RepeatGroupStructureCardProps) {
  const [repeatGroupHeight, setRepeatGroupHeight] = useState(0);
  const [repeatSegmentsY, setRepeatSegmentsY] = useState(0);
  const segmentOrder = useDirectListReorder<RunStructureSegment>({
    initialItems: item.segments,
    canExtractItem: () => true,
    extractThreshold: 12,
    onReorder: (_fromIndex, _toIndex, nextSegments) => {
      onSegmentsReordered(itemIndex, nextSegments);
    },
    onExtract: (fromIndex, direction, nextSegments, segmentValue) => {
      onSegmentExtracted(itemIndex, fromIndex, direction, nextSegments, segmentValue);
    },
  });
  const childDragActive = segmentOrder.dragState != null;
  const nestedExtractDirection = segmentOrder.dragState?.extractDirection ?? null;
  const extractAfterTop = repeatGroupHeight > 0
    ? Math.max(0, repeatGroupHeight - repeatSegmentsY + NESTED_EXTRACT_AFTER_GAP)
    : null;
  const extractBeforeGap = repeatSegmentsY + NESTED_EXTRACT_BEFORE_GAP;

  React.useEffect(() => {
    onNestedExtractionChange(itemIndex, nestedExtractDirection);
  }, [itemIndex, nestedExtractDirection, onNestedExtractionChange]);

  React.useEffect(() => () => {
    onNestedExtractionChange(itemIndex, null);
  }, [itemIndex, onNestedExtractionChange]);

  return (
    <View
      style={[
        styles.repeatGroupCard,
        dragging && styles.structureItemDragging,
        dragging && styles.repeatGroupCardDragging,
        childDragActive && styles.repeatGroupCardChildDragging,
      ]}
      onLayout={(event) => {
        const nextHeight = event.nativeEvent.layout.height;
        setRepeatGroupHeight((current) => (
          Math.abs(current - nextHeight) > 0.5 ? nextHeight : current
        ));
      }}
    >
      <View pointerEvents="none" style={styles.repeatGroupRail} />
      <View style={styles.repeatHeader}>
        <Pressable
          testID={`run-structure-repeat-toggle-${itemIndex}`}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand repeat group' : 'Collapse repeat group'}
          onPress={() => onToggleCollapsed(itemIndex)}
          style={({ pressed }) => [
            styles.repeatHeaderToggle,
            pressed && styles.repeatHeaderTogglePressed,
          ]}
        >
          <View style={styles.repeatHeaderTitleRow}>
            <View style={styles.repeatHeaderCopy}>
              <Text style={styles.itemTitle}>Repeat group</Text>
              <Text style={styles.itemCaption}>
                {item.repeats} rounds · {groupVolume(item)}
              </Text>
            </View>
          </View>
        </Pressable>
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
        </View>
      </View>
      {collapsed ? null : (
        <View
          style={styles.repeatSegments}
          onLayout={(event) => {
            const nextY = event.nativeEvent.layout.y;
            setRepeatSegmentsY((current) => (
              Math.abs(current - nextY) > 0.5 ? nextY : current
            ));
          }}
        >
          {segmentOrder.items.map((child, childIndex) => {
            const childDragging = segmentOrder.dragState?.fromIndex === childIndex;
            const childExtractDirection = childDragging
              ? segmentOrder.dragState?.extractDirection ?? null
              : null;
            const childExtracting = childExtractDirection != null;
            const childDropTarget =
              segmentOrder.dragState?.overIndex === childIndex
              && segmentOrder.dragState.fromIndex !== childIndex
              && !segmentOrder.dragState.extractDirection;
            const childPreviewOffset = segmentOrder.previewOffsetForIndex(childIndex);

            return (
              <ReorderableStructureItem
                key={`${itemIndex}-${childIndex}`}
                itemKey={`${itemIndex}-${childIndex}`}
                testID={`run-structure-repeat-item-${itemIndex}-${childIndex}`}
                dragging={Boolean(childDragging)}
                extracting={childExtracting}
                extractDirection={childExtractDirection}
                extractAfterTop={extractAfterTop}
                extractBeforeGap={extractBeforeGap}
                dragY={segmentOrder.dragY}
                dragOffset={segmentOrder.dragOffset}
                previewOffset={childPreviewOffset}
                onLayout={(event) => {
                  segmentOrder.registerSlotLayout(
                    childIndex,
                    event.nativeEvent.layout.y,
                    event.nativeEvent.layout.height,
                  );
                }}
              >
                {childDropTarget ? (
                  <View pointerEvents="none" style={styles.structureDropTargetOutline} />
                ) : null}
                {renderSegment(
                  child,
                  itemIndex,
                  childIndex,
                  true,
                  {
                    index: childIndex,
                    active: Boolean(childDragging),
                    recordTouchStart: segmentOrder.recordTouchStart,
                    beginDrag: segmentOrder.beginDrag,
                    updateDrag: segmentOrder.updateDrag,
                    cancelDrag: segmentOrder.cancelDrag,
                    finishDrag: segmentOrder.finishDrag,
                    onDragActiveChange,
                  },
                  () => onRemoveSegment(itemIndex, childIndex),
                  childExtracting,
                )}
              </ReorderableStructureItem>
            );
          })}
        </View>
      )}
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
  const [isStructureSwipeActive, setIsStructureSwipeActiveState] = useState(false);
  const [activeNestedRepeatIndex, setActiveNestedRepeatIndex] = useState<number | null>(null);
  const [activeNestedExtraction, setActiveNestedExtraction] = useState<{
    itemIndex: number;
    direction: DirectListReorderExtractDirection;
  } | null>(null);
  const suppressSegmentPressRef = React.useRef(false);
  const gestureSuppressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [customEdited, setCustomEdited] = useState(false);
  const [collapsedRepeatIndexes, setCollapsedRepeatIndexes] = useState<Set<number>>(() => new Set());
  const structureOrder = useDirectListReorder<RunStructureItem>({
    initialItems,
    canCombineItem: (draggedItem, targetItem, fromIndex, targetIndex, currentItems) => {
      if (!draggedItem || draggedItem.kind === 'REPEAT' || !targetItem) {
        return false;
      }

      if (targetItem.kind === 'REPEAT') {
        return true;
      }

      const firstIndex = Math.min(fromIndex, targetIndex);
      const secondIndex = Math.max(fromIndex, targetIndex);
      const skippedItems = currentItems.slice(firstIndex + 1, secondIndex);
      if (skippedItems.some((item) => item.kind === 'REPEAT')) {
        return false;
      }

      return fromIndex !== targetIndex;
    },
    combineItems: (current, fromIndex, targetIndex) => {
      const draggedItem = current[fromIndex];
      const targetItem = current[targetIndex];
      if (!draggedItem || draggedItem.kind === 'REPEAT' || !targetItem) {
        return current;
      }

      if (targetItem.kind === 'REPEAT') {
        return current.flatMap((item, index) => {
          if (index === fromIndex) return [];
          if (index !== targetIndex || item.kind !== 'REPEAT') return [item];
          return [{
            ...item,
            segments: [...item.segments, draggedItem],
          }];
        });
      }

      const segments = targetIndex < fromIndex
        ? [targetItem, draggedItem]
        : [draggedItem, targetItem];

      return current.flatMap((item, index) => {
        if (index === fromIndex) return [];
        if (index === targetIndex) return [repeat(2, segments)];
        return [item];
      });
    },
    onReorder: () => {
      clearCollapsedRepeatGroups();
      markCustomStructure();
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    },
    onCombine: () => {
      clearCollapsedRepeatGroups();
      markCustomStructure();
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    },
  });
  React.useEffect(() => {
    clearCollapsedRepeatGroups();
  }, [initialItems]);
  React.useEffect(() => () => {
    if (gestureSuppressTimerRef.current) {
      clearTimeout(gestureSuppressTimerRef.current);
    }
  }, []);
  const items = structureOrder.items;
  const isStructureScrollLocked = isStructureDragActive || isStructureSwipeActive;
  const type = draftSession.type ?? session.type ?? 'EASY';
  const typeMeta = SESSION_TYPE[type];
  const availableTemplates = useMemo(
    () => getStructuredSessionTemplatesForType(type),
    [type],
  );
  const visibleTemplates = useMemo(
    () => availableTemplates.filter((template) => template.key !== 'custom'),
    [availableTemplates],
  );
  const selectedTemplateOption = availableTemplates.find((template) => template.key === selectedTemplate);
  const selectedNamedTemplate = selectedTemplate !== 'custom' ? selectedTemplateOption : null;
  const showCustomStatus = selectedTemplate === 'custom' && (customEdited || session.runStructure != null);
  const customStatusLabel = customEdited ? 'Custom · changed' : 'Custom';
  const materialized = materializeStructuredSessionDraft({
    session: draftSession,
    items,
    planNote,
  });
  const summary = summariseRunStructure(materialized);
  const warning = structuredSessionMismatchWarning(materialized);
  const distanceTotal = distanceMetric(materialized);
  const timeTotal = timeMetric(materialized);
  const qualityTotal = qualityMetric(items, materialized);
  const simplePreview = convertStructuredSessionDraftToSimple({
    session: draftSession,
    items,
    planNote,
  });
  const simplePreviewDistance = simplePreview?.distance != null && simplePreview.distance > 0
    ? `${simplePreview.distance}km`
    : null;

  function markCustomStructure() {
    setSelectedTemplate('custom');
    setCustomEdited(true);
  }

  function holdSegmentPressSuppression(active: boolean) {
    if (gestureSuppressTimerRef.current) {
      clearTimeout(gestureSuppressTimerRef.current);
      gestureSuppressTimerRef.current = null;
    }

    if (active) {
      suppressSegmentPressRef.current = true;
      return;
    }

    gestureSuppressTimerRef.current = setTimeout(() => {
      suppressSegmentPressRef.current = false;
      gestureSuppressTimerRef.current = null;
    }, 220);
  }

  function setStructureDragActive(active: boolean) {
    setIsStructureDragActive(active);
    holdSegmentPressSuppression(active);
  }

  function setStructureSwipeActive(active: boolean) {
    setIsStructureSwipeActiveState(active);
    holdSegmentPressSuppression(active);
  }

  const handleNestedExtractionChange = React.useCallback((
    itemIndex: number,
    direction: DirectListReorderExtractDirection | null,
  ) => {
    setActiveNestedExtraction((current) => {
      if (direction == null) {
        return current?.itemIndex === itemIndex ? null : current;
      }

      if (current?.itemIndex === itemIndex && current.direction === direction) {
        return current;
      }

      return { itemIndex, direction };
    });
  }, []);

  function clearCollapsedRepeatGroups() {
    setCollapsedRepeatIndexes(new Set());
  }

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
    setCustomEdited(false);
    setDraftSession(next.session);
    structureOrder.replaceItems(next.items);
    clearCollapsedRepeatGroups();
    setError(null);
    setExpandedSegmentKey(null);
    setCustomVolumeKey(null);
    setCustomPaceKey(null);
    setTemplatesExpanded(false);
  }

  function changeType(nextType: SessionType) {
    if (nextType === type) {
      return;
    }

    if (!sessionTypeSupportsStructuredFormat(nextType)) {
      onChangeFormat?.(
        'simple',
        buildSimpleSessionForUnsupportedStructuredFormat({
          session: {
            ...draftSession,
            type: nextType,
            planNote,
          },
          planNote,
        }),
        {
          restoreStructuredDraft: materialized,
          pendingStructureClear: true,
          pendingStructureClearReason: nextType === 'REST' ? 'rest' : 'recovery',
        },
      );
      return;
    }

    setDraftSession((current) => ({
      ...current,
      type: nextType,
      format: 'structured',
      intensityTarget: current.intensityTarget ?? defaultIntensityTargetForSessionType(nextType),
    }));
    markCustomStructure();
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
      markCustomStructure();
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    }
  }

  function toggleRepeatCollapsed(itemIndex: number) {
    setCollapsedRepeatIndexes((current) => {
      const next = new Set(current);
      if (next.has(itemIndex)) {
        next.delete(itemIndex);
      } else {
        next.add(itemIndex);
      }
      return next;
    });
  }

  function addRunSegment() {
    structureOrder.updateItems((current) => [
      ...current,
      segment('RUN', { unit: 'km', value: 1 }, defaultIntensityTargetForSessionType(type)),
    ]);
    markCustomStructure();
    setExpandedSegmentKey(null);
    setCustomPaceKey(null);
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
    onChangeFormat?.('simple', simplePreview, {
      restoreStructuredDraft: materialized,
      pendingStructureClear: true,
      pendingStructureClearReason: 'simple',
    });
  }

  function removeItem(itemIndex: number) {
    structureOrder.updateItems((current) => current.filter((_, index) => index !== itemIndex));
    markCustomStructure();
    clearCollapsedRepeatGroups();
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
    markCustomStructure();
    setExpandedSegmentKey(null);
    setCustomVolumeKey(null);
    setCustomPaceKey(null);
  }

  function removeRepeatSegment(itemIndex: number, segmentIndex: number) {
    let changed = false;
    structureOrder.updateItems((current) => current.flatMap((item, index) => {
      if (index !== itemIndex || item.kind !== 'REPEAT') return [item];
      const nextSegments = item.segments.filter((_, childIndex) => childIndex !== segmentIndex);
      changed = nextSegments.length !== item.segments.length;
      return nextSegments.length > 0 ? [{ ...item, segments: nextSegments }] : [];
    }));
    if (changed) {
      markCustomStructure();
      clearCollapsedRepeatGroups();
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    }
  }

  function extractRepeatSegment(
    itemIndex: number,
    _segmentIndex: number,
    direction: DirectListReorderExtractDirection,
    nextSegments: RunStructureSegment[],
    segmentValue: RunStructureSegment,
  ) {
    let changed = false;
    structureOrder.updateItems((current) => current.flatMap((item, index) => {
      if (index !== itemIndex || item.kind !== 'REPEAT') return [item];
      changed = true;
      const nextGroup = nextSegments.length > 0 ? [{ ...item, segments: nextSegments }] : [];
      return direction === 'before'
        ? [segmentValue, ...nextGroup]
        : [...nextGroup, segmentValue];
    }));
    if (changed) {
      markCustomStructure();
      clearCollapsedRepeatGroups();
      setExpandedSegmentKey(null);
      setCustomVolumeKey(null);
      setCustomPaceKey(null);
    }
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
      markCustomStructure();
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
      markCustomStructure();
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
              color: C.ink2,
            }))}
            selected={segmentValue.kind}
            onSelect={(kind) => {
              const nextKind = kind as RunStructureSegmentKind;
              const changed = updateSegment(itemIndex, segmentIndex, (current) => (
                current.kind === nextKind ? current : { ...current, kind: nextKind }
              ));
              if (changed) {
                markCustomStructure();
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
    dragControls: StructureDragControls,
    onDelete?: () => void,
    standalonePreview = false,
  ) {
    const key = segmentEditorKey(itemIndex, segmentIndex);
    const expanded = expandedSegmentKey === key;
    const metricColor = volumeMetricColor(segmentValue.volume.unit);

    return (
      <SwipeDeleteSegment
        key={`${itemIndex}-${segmentIndex ?? 'single'}`}
        testID={`run-structure-segment-swipe-${itemIndex}-${segmentIndex ?? 'single'}`}
        disabled={!onDelete || isStructureDragActive}
        dragControls={dragControls}
        onSwipeActiveChange={setStructureSwipeActive}
        onDelete={() => onDelete?.()}
      >
        <View
          style={[
            styles.segmentCard,
            nested && !standalonePreview && styles.segmentCardNested,
            dragControls.active && styles.segmentCardDragging,
          ]}
        >
          <Pressable
            testID={`run-structure-segment-${itemIndex}-${segmentIndex ?? 'single'}`}
            accessibilityRole="button"
            onPress={() => {
              if (suppressSegmentPressRef.current) {
                return;
              }
              setExpandedSegmentKey(expanded ? null : key);
              setCustomVolumeKey(null);
              setCustomPaceKey(null);
            }}
            style={styles.segmentSummary}
          >
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
      </SwipeDeleteSegment>
    );
  }

  const headerTitle = `${distanceTotal.value} ${typeHeaderLabel(type)} · Structured`;

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
        testID={isStructureScrollLocked ? 'run-structure-scroll-locked' : 'run-structure-scroll'}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        scrollEnabled={!isStructureScrollLocked}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <SessionTypeCardGrid
            types={STRUCTURED_EDITOR_SESSION_TYPES}
            value={type}
            onChange={changeType}
          />
        </View>

        <View style={styles.section}>
          <SectionLabel>Format</SectionLabel>
          <FormatSegmentedControl onSimplePress={() => setShowConvertConfirm(true)} />
          {showConvertConfirm ? (
            <View style={styles.convertCard}>
              <Text style={styles.convertTitle}>Switch to Simple?</Text>
              <Text style={styles.convertCopy}>
                Simple keeps {simplePreviewDistance ?? 'the current total'} as one run and discards the segment structure.
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
          <Text style={styles.formatHelper}>
            Simple keeps it as a single run. Structured breaks it into segments.
          </Text>
        </View>

        <MetricSummaryCards
          distance={distanceTotal}
          time={timeTotal}
          quality={qualityTotal}
        />

        <View style={styles.section}>
          <SectionLabel>Templates</SectionLabel>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTemplatesExpanded((current) => !current)}
            style={({ pressed }) => [styles.templateSummaryCard, pressed && styles.templatePressed]}
          >
            <View style={styles.templateSummaryCopy}>
              <View style={styles.templateTitleRow}>
                <Text style={styles.templateTitle}>
                  {selectedNamedTemplate ? `Template · ${selectedNamedTemplate.label}` : 'Start from a template'}
                </Text>
                {showCustomStatus ? (
                  <Text style={styles.customTemplateBadge}>{customStatusLabel}</Text>
                ) : null}
              </View>
              <Text style={styles.templateCaption}>
                {selectedNamedTemplate
                  ? 'Tap to change. Editing any segment makes it custom.'
                  : 'Optional starting point.'}
              </Text>
            </View>
            <Text style={styles.templateToggle}>
              {templatesExpanded ? 'Hide' : selectedNamedTemplate ? 'Change' : 'Browse'}
            </Text>
          </Pressable>
          {templatesExpanded ? (
            <View style={styles.templateList}>
              {visibleTemplates.map((template) => {
                const active = selectedTemplate === template.key;
                return (
                  <Pressable
                    key={template.key}
                    testID={`run-structure-template-${template.key}`}
                    accessibilityRole="button"
                    onPress={() => applyTemplate(template)}
                    style={[
                      styles.templateRow,
                      active && styles.templateRowActive,
                    ]}
                  >
                    <View style={styles.templateSummaryCopy}>
                      <Text style={styles.templateTitle}>{template.label}</Text>
                      <Text style={styles.templateCaption}>{template.caption}</Text>
                    </View>
                    {active ? <Text style={styles.templateSelectedText}>Selected ✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.structureHeaderRow}>
            <Text style={styles.structureHeaderLabel}>Structure</Text>
            <Text style={styles.structureHeaderHint}>Drag to reorder</Text>
          </View>
          {summary ? <Text style={styles.structureSummaryLine}>{summary}</Text> : null}
          {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.itemsList}>
            {items.map((item, itemIndex) => {
              const dragging = structureOrder.dragState?.fromIndex === itemIndex;
              const combineTarget = structureOrder.dragState?.combineIndex === itemIndex;
              const dropTarget =
                structureOrder.dragState?.overIndex === itemIndex
                && structureOrder.dragState.fromIndex !== itemIndex
                && !combineTarget;
              const nestedExtractionOffset = (() => {
                if (!activeNestedExtraction) return 0;
                if (
                  activeNestedExtraction.direction === 'after'
                  && itemIndex > activeNestedExtraction.itemIndex
                ) {
                  return NESTED_EXTRACT_SLOT_HEIGHT;
                }
                if (
                  activeNestedExtraction.direction === 'before'
                  && itemIndex >= activeNestedExtraction.itemIndex
                ) {
                  return NESTED_EXTRACT_SLOT_HEIGHT;
                }
                return 0;
              })();
              const previewOffset = structureOrder.previewOffsetForIndex(itemIndex)
                + nestedExtractionOffset;
              const dragControls: StructureDragControls = {
                index: itemIndex,
                active: Boolean(dragging),
                recordTouchStart: structureOrder.recordTouchStart,
                beginDrag: structureOrder.beginDrag,
                updateDrag: structureOrder.updateDrag,
                cancelDrag: structureOrder.cancelDrag,
                finishDrag: structureOrder.finishDrag,
                onDragActiveChange: setStructureDragActive,
              };

              return (
                <ReorderableStructureItem
                  key={`${item.kind}-${itemIndex}`}
                  itemKey={`${item.kind}-${itemIndex}`}
                  testID={`run-structure-item-${itemIndex}`}
                  dragging={Boolean(dragging)}
                  elevated={activeNestedRepeatIndex === itemIndex}
                  dragY={structureOrder.dragY}
                  previewOffset={previewOffset}
                  onLayout={(event) => {
                    structureOrder.registerSlotLayout(
                      itemIndex,
                      event.nativeEvent.layout.y,
                      event.nativeEvent.layout.height,
                    );
                  }}
                >
                  {dropTarget ? (
                    <View
                      testID={`run-structure-swap-target-${itemIndex}`}
                      pointerEvents="none"
                      style={styles.structureDropTargetOutline}
                    />
                  ) : null}
                  {combineTarget ? (
                    <View
                      testID={`run-structure-combine-target-${itemIndex}`}
                      pointerEvents="none"
                      style={styles.structureCombineTargetOutline}
                    >
                      <Text style={styles.structureCombineTargetText}>
                        {item.kind === 'REPEAT' ? 'Drop to add to group' : 'Drop to group'}
                      </Text>
                    </View>
                  ) : null}
                  {item.kind === 'REPEAT' ? (
                    <SwipeDeleteSegment
                      testID={`run-structure-group-swipe-${itemIndex}`}
                      disabled={isStructureDragActive}
                      overflowVisible={activeNestedRepeatIndex === itemIndex}
                      dragControls={dragControls}
                      onSwipeActiveChange={setStructureSwipeActive}
                      onDelete={() => removeItem(itemIndex)}
                    >
                      <RepeatGroupStructureCard
                        item={item}
                        itemIndex={itemIndex}
                        dragging={Boolean(dragging)}
                        collapsed={collapsedRepeatIndexes.has(itemIndex)}
                        onSetRepeatCount={setRepeatCount}
                        onToggleCollapsed={toggleRepeatCollapsed}
                        onSegmentsReordered={replaceRepeatSegments}
                        onRemoveSegment={removeRepeatSegment}
                        onSegmentExtracted={extractRepeatSegment}
                        onNestedExtractionChange={handleNestedExtractionChange}
                        onDragActiveChange={(active) => {
                          setActiveNestedRepeatIndex(active ? itemIndex : null);
                          if (!active) {
                            handleNestedExtractionChange(itemIndex, null);
                          }
                          setStructureDragActive(active);
                        }}
                        renderSegment={renderSegment}
                      />
                    </SwipeDeleteSegment>
                  ) : (
                    <View style={[styles.itemShell, dragging && styles.structureItemDragging]}>
                      {renderSegment(item, itemIndex, null, false, dragControls, () => removeItem(itemIndex))}
                    </View>
                  )}
                </ReorderableStructureItem>
              );
            })}
          </View>

          <View style={styles.addPanel}>
            <Pressable
              accessibilityRole="button"
              onPress={addRunSegment}
              style={({ pressed }) => [styles.addSegmentButton, pressed && styles.addSegmentButtonPressed]}
            >
              <Text style={styles.addSegmentText}>+ Add segment</Text>
            </Pressable>
            <Text style={styles.addHint}>
              Drag and drop segments together to create a repeat group.
            </Text>
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
  formatSegmentedControl: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
  },
  formatSegment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  formatSegmentPressed: {
    opacity: 0.72,
  },
  formatSegmentActive: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.ink2,
  },
  formatSegmentText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
  },
  formatSegmentTextActive: {
    color: C.ink2,
  },
  formatHelper: {
    marginTop: 7,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  templateList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    overflow: 'hidden',
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
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  customTemplateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    color: C.ink2,
  },
  templateToggle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    backgroundColor: C.surface,
  },
  templateRowActive: {
    borderLeftColor: C.clay,
    backgroundColor: `${C.clay}0A`,
  },
  templateSelectedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.statusConnected,
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
    marginBottom: 18,
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
    borderColor: `${C.metricDistance}25`,
    backgroundColor: `${C.metricDistance}10`,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.ink2,
  },
  errorText: {
    marginBottom: 10,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: C.clay,
  },
  structureHeaderRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  structureHeaderLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.muted,
  },
  structureHeaderHint: {
    flexShrink: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.muted,
    textAlign: 'right',
  },
  itemsList: {
    gap: 10,
  },
  structureItemWrap: {
    position: 'relative',
  },
  structureItemWrapExtracting: {
    position: 'absolute',
    left: -24,
    right: -10,
  },
  structureItemWrapDragging: {
    zIndex: 30,
    elevation: 8,
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
  structureCombineTargetOutline: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    zIndex: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.clay,
    borderStyle: 'dashed',
    backgroundColor: `${C.clay}0D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureCombineTargetText: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: `${C.clay}55`,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: C.clay,
  },
  itemShell: {
    gap: 6,
  },
  swipeDeleteShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  swipeDeleteShellOverflowVisible: {
    overflow: 'visible',
  },
  swipeDeleteAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: `${C.clay}14`,
    borderWidth: 1,
    borderColor: `${C.clay}40`,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  swipeDeleteActionArmed: {
    backgroundColor: C.clay,
    borderColor: C.clay,
  },
  swipeDeleteTextWrap: {
    position: 'absolute',
    right: 0,
    width: SWIPE_ACTION_LABEL_WIDTH,
    alignItems: 'center',
  },
  swipeDeleteText: {
    textAlign: 'center',
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: C.clay,
  },
  swipeDeleteTextArmed: {
    color: C.surface,
  },
  repeatGroupCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.cream,
    padding: 10,
    gap: 10,
    position: 'relative',
    overflow: 'visible',
  },
  repeatGroupCardDragging: {
    borderColor: `${C.clay}AA`,
  },
  repeatGroupCardChildDragging: {
    zIndex: 40,
    elevation: 10,
  },
  repeatGroupRail: {
    position: 'absolute',
    left: -1,
    top: 44,
    bottom: 44,
    width: 3,
    borderRadius: 2,
    backgroundColor: C.clay,
    opacity: 0.55,
  },
  repeatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  repeatHeaderToggle: {
    flex: 1,
    minHeight: 46,
    margin: -6,
    padding: 6,
    borderRadius: 12,
    justifyContent: 'center',
  },
  repeatHeaderTogglePressed: {
    backgroundColor: `${C.border}55`,
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
    gap: 6,
    paddingLeft: 14,
    overflow: 'visible',
    zIndex: 20,
  },
  segmentCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  segmentCardDragging: {
    borderColor: `${C.clay}AA`,
    backgroundColor: C.surface,
  },
  segmentCardNested: {
    backgroundColor: C.surface,
    borderColor: `${C.border}CC`,
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
  addSegmentButton: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: `${C.ink2}55`,
    borderStyle: 'dashed',
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSegmentButtonPressed: {
    opacity: 0.78,
  },
  addSegmentText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  addHint: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.muted,
    textAlign: 'center',
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
    borderColor: `${C.metricDistance}25`,
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
