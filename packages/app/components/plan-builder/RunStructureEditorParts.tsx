import React, { useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  RunStructureItem,
  RunStructureSegment,
} from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import {
  useDirectListReorder,
  type DirectListReorderDragState,
  type DirectListReorderExtractDirection,
} from '../../features/plan-builder/use-direct-list-reorder';
import {
  groupVolume,
  type StructuredSessionMetric,
} from '../../features/plan-builder/structured-session-editor-view-model';

const LONG_PRESS_DRAG_DELAY_MS = 360;
const GESTURE_INTENT_SLOP = 8;
const SWIPE_DELETE_THRESHOLD = 118;
const SWIPE_ACTION_LABEL_WIDTH = 112;
export const NESTED_EXTRACT_SLOT_HEIGHT = 76;
const NESTED_EXTRACT_AFTER_GAP = 8;
const NESTED_EXTRACT_BEFORE_GAP = 26;
const STRUCTURE_PREVIEW_ANIMATION_MS = 130;
const NESTED_EXTRACT_ANIMATION_MS = 155;
const USE_STRUCTURE_MOTION = Platform.OS !== 'web' && typeof globalThis.document === 'undefined';

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

export interface StructureDragControls {
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

export function FormatSegmentedControl({ onSimplePress }: FormatSegmentedControlProps) {
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
  distance: StructuredSessionMetric;
  time: StructuredSessionMetric;
  quality: StructuredSessionMetric;
}

export function MetricSummaryCards({ distance, time, quality }: MetricSummaryCardsProps) {
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

export function ReorderableStructureItem({
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

export function SwipeDeleteSegment({
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

export function RepeatGroupStructureCard({
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

const styles = StyleSheet.create({
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
});
