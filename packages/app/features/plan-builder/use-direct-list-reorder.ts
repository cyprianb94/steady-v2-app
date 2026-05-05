import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { triggerDragSlotHaptic, triggerDragStartHaptic } from '../../lib/haptics';

export interface DirectListReorderDragState {
  fromIndex: number;
  overIndex: number;
  combineIndex: number | null;
  extractDirection: DirectListReorderExtractDirection | null;
}

export type DirectListReorderExtractDirection = 'before' | 'after';

interface UseDirectListReorderOptions<T> {
  initialItems: readonly T[];
  canDragItem?: (item: T | null, index: number) => boolean;
  canDropItem?: (item: T | null, index: number) => boolean;
  canCombineItem?: (
    draggedItem: T | null,
    targetItem: T | null,
    fromIndex: number,
    targetIndex: number,
    items: readonly T[],
  ) => boolean;
  canExtractItem?: (item: T | null, index: number) => boolean;
  swapItems?: (items: T[], fromIndex: number, toIndex: number) => T[];
  combineItems?: (items: T[], fromIndex: number, targetIndex: number) => T[];
  dragSlotPitch?: number;
  swapPreviewOffset?: number;
  extractThreshold?: number;
  onReorder?: (fromIndex: number, toIndex: number, items: T[]) => void;
  onCombine?: (fromIndex: number, targetIndex: number, items: T[]) => void;
  onExtract?: (
    fromIndex: number,
    direction: DirectListReorderExtractDirection,
    items: T[],
    item: T,
  ) => void;
}

interface DirectListReorderResult<T> {
  items: T[];
  dragState: DirectListReorderDragState | null;
  dragY: Animated.Value;
  dragOffset: number;
  isHandleActive: boolean;
  canDragIndex: (index: number) => boolean;
  canDropIndex: (index: number) => boolean;
  previewOffsetForIndex: (index: number) => number;
  registerSlotLayout: (index: number, y: number, height: number) => void;
  recordTouchStart: (pageY: number) => void;
  beginDrag: (index: number) => boolean;
  updateDrag: (pageY: number) => void;
  finishDrag: () => DirectListReorderDragState | null;
  cancelDrag: () => void;
  replaceItem: (index: number, item: T) => void;
  replaceItems: (nextItems: readonly T[]) => void;
  updateItems: (updater: (items: T[]) => T[]) => void;
  restoreDraft: (nextItems: readonly T[]) => void;
  reset: () => void;
}

const DEFAULT_DRAG_SLOT_PITCH = 58;
const DEFAULT_SWAP_PREVIEW_OFFSET = 14;
const DEFAULT_COMBINE_ENTRY_RADIUS = 18;
const DEFAULT_COMBINE_ENTRY_CUSHION = 8;

interface SlotLayout {
  centerY: number;
  topY: number;
  bottomY: number;
}

interface MeasuredDragTarget {
  overIndex: number;
  combineIndex: number | null;
}

function defaultSwapItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
    || fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const from = next[fromIndex];
  next[fromIndex] = next[toIndex];
  next[toIndex] = from;
  return next;
}

export function useDirectListReorder<T>({
  initialItems,
  canDragItem = (item) => item != null,
  canDropItem = () => true,
  canCombineItem = () => false,
  canExtractItem = () => false,
  swapItems = defaultSwapItems,
  combineItems,
  dragSlotPitch = DEFAULT_DRAG_SLOT_PITCH,
  swapPreviewOffset = DEFAULT_SWAP_PREVIEW_OFFSET,
  extractThreshold = DEFAULT_DRAG_SLOT_PITCH,
  onReorder,
  onCombine,
  onExtract,
}: UseDirectListReorderOptions<T>): DirectListReorderResult<T> {
  const [items, setItemsState] = useState<T[]>(() => [...initialItems]);
  const [dragState, setDragState] = useState<DirectListReorderDragState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isHandleActive, setIsHandleActive] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const itemsRef = useRef<T[]>([...initialItems]);
  const dragStateRef = useRef<DirectListReorderDragState | null>(null);
  const pressStartPageYRef = useRef(0);
  const slotLayoutsRef = useRef<Record<number, SlotLayout>>({});
  const activeSlotLayoutsRef = useRef<Record<number, SlotLayout> | null>(null);

  function setItems(nextItems: T[]) {
    itemsRef.current = nextItems;
    setItemsState(nextItems);
  }

  function setCurrentDragState(nextDragState: DirectListReorderDragState | null) {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function restoreDraft(nextItems: readonly T[]) {
    setItems([...nextItems]);
    setIsHandleActive(false);
    setDragOffset(0);
    dragY.setValue(0);
    activeSlotLayoutsRef.current = null;
    setCurrentDragState(null);
  }

  useEffect(() => {
    restoreDraft(initialItems);
  }, [initialItems]);

  function currentItem(index: number): T | null {
    return itemsRef.current[index] ?? null;
  }

  function canDragIndex(index: number) {
    return canDragItem(currentItem(index), index);
  }

  function canDropIndex(index: number) {
    return canDropItem(currentItem(index), index);
  }

  function registerSlotLayout(index: number, y: number, height: number) {
    if (activeSlotLayoutsRef.current) {
      return;
    }

    slotLayoutsRef.current[index] = {
      topY: y,
      centerY: y + height / 2,
      bottomY: y + height,
    };
  }

  function slotLayoutsForDrag() {
    return activeSlotLayoutsRef.current ?? slotLayoutsRef.current;
  }

  function layoutForIndex(index: number) {
    return slotLayoutsForDrag()[index];
  }

  function cloneSlotLayouts(layouts: Record<number, SlotLayout>) {
    return Object.fromEntries(
      Object.entries(layouts).map(([index, layout]) => [
        index,
        { ...layout },
      ]),
    ) as Record<number, SlotLayout>;
  }

  function applySwap(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return;
    }

    if (!canDragIndex(fromIndex) || !canDropIndex(toIndex)) {
      return;
    }

    const nextItems = swapItems(itemsRef.current, fromIndex, toIndex);
    setItems(nextItems);
    onReorder?.(fromIndex, toIndex, nextItems);
  }

  function applyCombine(fromIndex: number, targetIndex: number) {
    if (
      fromIndex === targetIndex
      || !combineItems
      || !canDragIndex(fromIndex)
      || !canCombineItem(
        currentItem(fromIndex),
        currentItem(targetIndex),
        fromIndex,
        targetIndex,
        itemsRef.current,
      )
    ) {
      return false;
    }

    const nextItems = combineItems(itemsRef.current, fromIndex, targetIndex);
    setItems(nextItems);
    onCombine?.(fromIndex, targetIndex, nextItems);
    return true;
  }

  function recordTouchStart(pageY: number) {
    pressStartPageYRef.current = pageY;
    setIsHandleActive(true);
  }

  function beginDrag(index: number) {
    if (!canDragIndex(index)) {
      return false;
    }

    activeSlotLayoutsRef.current = cloneSlotLayouts(slotLayoutsRef.current);
    setDragOffset(0);
    dragY.setValue(0);
    setCurrentDragState({
      fromIndex: index,
      overIndex: index,
      combineIndex: null,
      extractDirection: null,
    });
    triggerDragStartHaptic();
    return true;
  }

  function updateDrag(pageY: number) {
    const current = dragStateRef.current;
    if (!current) {
      return;
    }

    const dy = pageY - pressStartPageYRef.current;
    dragY.setValue(dy);
    setDragOffset(dy);

    const draggedCenterY = getDraggedCenterY(current.fromIndex, dy);
    const measuredTarget = getMeasuredDragTarget(current.fromIndex, draggedCenterY);
    const offset = Math.trunc(dy / dragSlotPitch);
    const overIndex =
      measuredTarget?.overIndex ??
      getFallbackOverIndex(current.fromIndex, offset);
    const extractDirection = getExtractDirection(current.fromIndex, dy, offset, draggedCenterY);
    const combineIndex = extractDirection
      ? null
      : measuredTarget?.combineIndex ?? getFallbackCombineIndex(current.fromIndex, overIndex, dy);

    if (
      current.overIndex !== overIndex
      || current.combineIndex !== combineIndex
      || current.extractDirection !== extractDirection
    ) {
      setCurrentDragState({ ...current, overIndex, combineIndex, extractDirection });
      if (extractDirection != null || combineIndex != null || canDropIndex(overIndex)) {
        triggerDragSlotHaptic();
      }
    }
  }

  function getDraggedCenterY(fromIndex: number, dy: number) {
    const sourceCenter = layoutForIndex(fromIndex)?.centerY;
    return sourceCenter == null ? null : sourceCenter + dy;
  }

  function getMeasuredDragTarget(
    fromIndex: number,
    draggedCenterY: number | null,
  ): MeasuredDragTarget | null {
    const layouts = slotLayoutsForDrag();
    if (draggedCenterY == null || layouts[fromIndex]?.centerY == null) {
      return null;
    }

    const draggedItem = currentItem(fromIndex);
    let closestTarget: MeasuredDragTarget | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < itemsRef.current.length; index += 1) {
      if (index === fromIndex) {
        continue;
      }

      const layout = layouts[index];
      if (!layout) {
        continue;
      }

      const canCombine = canCombineItem(
        draggedItem,
        currentItem(index),
        fromIndex,
        index,
        itemsRef.current,
      );
      const combineIndex =
        canCombine && isInDirectionalCombineBand(layout, draggedCenterY, fromIndex, index)
          ? index
          : null;
      const isSwapTarget = isInDirectionalSwapBand(
        layout,
        draggedCenterY,
        fromIndex,
        index,
        canCombine,
      );

      if (combineIndex == null && !isSwapTarget) {
        continue;
      }

      const distance = Math.abs(layout.centerY - draggedCenterY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestTarget = {
          overIndex: index,
          combineIndex,
        };
      }
    }

    return closestTarget;
  }

  function getFallbackOverIndex(fromIndex: number, offset: number) {
    if (offset === 0) {
      return fromIndex;
    }

    return Math.max(0, Math.min(itemsRef.current.length - 1, fromIndex + offset));
  }

  function getFallbackCombineIndex(fromIndex: number, overIndex: number, dy: number) {
    if (overIndex === fromIndex) {
      return null;
    }

    if (
      canCombineItem(
        currentItem(fromIndex),
        currentItem(overIndex),
        fromIndex,
        overIndex,
        itemsRef.current,
      )
      && isInFallbackCombineCenter(fromIndex, overIndex, dy)
    ) {
      return overIndex;
    }

    return null;
  }

  function isInDirectionalCombineBand(
    layout: SlotLayout,
    draggedCenterY: number,
    fromIndex: number,
    targetIndex: number,
  ) {
    const height = layout.bottomY - layout.topY;
    const cushion = Math.min(DEFAULT_COMBINE_ENTRY_CUSHION, height * 0.18);

    if (targetIndex < fromIndex) {
      return draggedCenterY >= layout.centerY && draggedCenterY <= layout.bottomY + cushion;
    }

    return draggedCenterY <= layout.centerY && draggedCenterY >= layout.topY - cushion;
  }

  function isInDirectionalSwapBand(
    layout: SlotLayout,
    draggedCenterY: number,
    fromIndex: number,
    targetIndex: number,
    canCombineWithTarget: boolean,
  ) {
    if (!canCombineWithTarget) {
      return draggedCenterY >= layout.topY && draggedCenterY <= layout.bottomY;
    }

    if (targetIndex < fromIndex) {
      return draggedCenterY >= layout.topY && draggedCenterY < layout.centerY;
    }

    return draggedCenterY > layout.centerY && draggedCenterY <= layout.bottomY;
  }

  function isInFallbackCombineCenter(fromIndex: number, targetIndex: number, dy: number) {
    const targetOffset = (targetIndex - fromIndex) * dragSlotPitch;
    const radius = Math.min(DEFAULT_COMBINE_ENTRY_RADIUS, dragSlotPitch * 0.32);
    return Math.abs(dy - targetOffset) <= radius;
  }

  function getExtractDirection(
    fromIndex: number,
    dy: number,
    offset: number,
    draggedCenterY: number | null,
  ): DirectListReorderExtractDirection | null {
    const draggedItem = currentItem(fromIndex);
    if (!canExtractItem(draggedItem, fromIndex)) {
      return null;
    }

    const layouts = Object.values(slotLayoutsForDrag());
    if (layouts.length > 0 && draggedCenterY != null) {
      const topY = Math.min(...layouts.map((layout) => layout.topY));
      const bottomY = Math.max(...layouts.map((layout) => layout.bottomY));
      if (draggedCenterY < topY - extractThreshold) {
        return 'before';
      }
      if (draggedCenterY > bottomY + extractThreshold) {
        return 'after';
      }
      return null;
    }

    const projectedIndex = fromIndex + offset;
    if (projectedIndex < 0 && dy < 0) {
      return 'before';
    }
    if (projectedIndex > itemsRef.current.length - 1 && dy > 0) {
      return 'after';
    }
    return null;
  }

  function applyExtract(
    fromIndex: number,
    direction: DirectListReorderExtractDirection,
  ) {
    const item = currentItem(fromIndex);
    if (!item || !canDragIndex(fromIndex) || !canExtractItem(item, fromIndex)) {
      return false;
    }

    const nextItems = itemsRef.current.filter((_currentItem, index) => index !== fromIndex);
    setItems(nextItems);
    onExtract?.(fromIndex, direction, nextItems, item);
    return true;
  }

  function previewOffsetForIndex(index: number) {
    const current = dragStateRef.current;
    if (
      !current
      || current.fromIndex === index
      || current.overIndex !== index
      || current.combineIndex != null
      || current.extractDirection != null
    ) {
      return 0;
    }

    const sourceLayout = layoutForIndex(current.fromIndex);
    const targetLayout = layoutForIndex(index);
    if (sourceLayout && targetLayout) {
      const centerOffset = sourceLayout.centerY - targetLayout.centerY;
      if (Math.abs(centerOffset) > swapPreviewOffset) {
        return centerOffset;
      }

      return Math.sign(centerOffset) * swapPreviewOffset;
    }

    return Math.sign(current.fromIndex - index) * swapPreviewOffset;
  }

  function finishDrag() {
    const current = dragStateRef.current;
    setIsHandleActive(false);
    setDragOffset(0);
    dragY.setValue(0);
    activeSlotLayoutsRef.current = null;
    setCurrentDragState(null);

    if (!current) {
      return null;
    }

    if (current.extractDirection && applyExtract(current.fromIndex, current.extractDirection)) {
      return current;
    }

    if (current.combineIndex != null && applyCombine(current.fromIndex, current.combineIndex)) {
      return current;
    }

    applySwap(current.fromIndex, current.overIndex);
    return current;
  }

  function cancelDrag() {
    setIsHandleActive(false);
    setDragOffset(0);
    dragY.setValue(0);
    activeSlotLayoutsRef.current = null;
    setCurrentDragState(null);
  }

  function replaceItem(index: number, item: T) {
    const next = [...itemsRef.current];
    next[index] = item;
    setItems(next);
  }

  function replaceItems(nextItems: readonly T[]) {
    setItems([...nextItems]);
  }

  function updateItems(updater: (items: T[]) => T[]) {
    setItems(updater(itemsRef.current));
  }

  function reset() {
    restoreDraft(initialItems);
  }

  return {
    items,
    dragState,
    dragY,
    dragOffset,
    isHandleActive,
    canDragIndex,
    canDropIndex,
    previewOffsetForIndex,
    registerSlotLayout,
    recordTouchStart,
    beginDrag,
    updateDrag,
    finishDrag,
    cancelDrag,
    replaceItem,
    replaceItems,
    updateItems,
    restoreDraft,
    reset,
  };
}
