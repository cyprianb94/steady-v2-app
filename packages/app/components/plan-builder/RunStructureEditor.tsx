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
  summariseRunStructure,
  type IntensityTarget,
  type PlannedSession,
  type RunStructureItem,
  type RunStructureSegment,
  type RunStructureSegmentKind,
  type RunStructureVolume,
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
  manualPaceIntensityTarget,
  targetRepresentativePace,
} from '../../features/plan-builder/session-editing';
import {
  normalizeCustomPace,
  pacePresetsAround,
} from '../../features/plan-builder/session-editor-targets';
import {
  distanceMetric,
  formatVolume,
  intensityTargetsMatch,
  parsePositiveNumber,
  qualityMetric,
  segmentIntensityLabel,
  segmentKindLabel,
  segmentPaceOptions,
  selectedSegmentPaceKey,
  targetForProfileKey,
  timeMetric,
  typeHeaderLabel,
  volumeMetricColor,
  volumePresets,
  volumesMatch,
  SEGMENT_KINDS,
  VOLUME_UNITS,
} from '../../features/plan-builder/structured-session-editor-view-model';
import { usePreferences } from '../../providers/preferences-context';
import { Btn } from '../ui/Btn';
import { ChipRow } from '../ui/ChipRow';
import { ChipStripEditor } from '../ui/ChipStripEditor';
import { EditableChipStrip } from '../ui/EditableChipStrip';
import { SectionLabel } from '../ui/SectionLabel';
import { UnitTogglePill } from '../ui/UnitTogglePill';
import { SessionTypeCardGrid } from './SessionTypeCardGrid';
import {
  FormatSegmentedControl,
  MetricSummaryCards,
  NESTED_EXTRACT_SLOT_HEIGHT,
  ReorderableStructureItem,
  RepeatGroupStructureCard,
  SwipeDeleteSegment,
  type StructureDragControls,
} from './RunStructureEditorParts';

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
type TemplateKey = StructuredSessionTemplateKey;
const STRUCTURED_EDITOR_SESSION_TYPES: SessionType[] = [
  'EASY',
  'RECOVERY',
  'INTERVAL',
  'TEMPO',
  'LONG',
  'REST',
];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function pacePresets(currentPace: string | null | undefined): string[] {
  return pacePresetsAround(currentPace);
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
            placeholder="Add plan wording or context."
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
