import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { triggerDragSlotHaptic, triggerDragStartHaptic } from '../../lib/haptics';

export interface DirectListReorderDragState {
  fromIndex: number;
  overIndex: number;
}

interface UseDirectListReorderOptions<T> {
  initialItems: readonly T[];
  canDragItem?: (item: T | null, index: number) => boolean;
  canDropItem?: (item: T | null, index: number) => boolean;
  swapItems?: (items: T[], fromIndex: number, toIndex: number) => T[];
  dragSlotPitch?: number;
  onReorder?: (fromIndex: number, toIndex: number, items: T[]) => void;
}

interface DirectListReorderResult<T> {
  items: T[];
  dragState: DirectListReorderDragState | null;
  dragY: Animated.Value;
  isHandleActive: boolean;
  canDragIndex: (index: number) => boolean;
  canDropIndex: (index: number) => boolean;
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

interface SlotLayout {
  centerY: number;
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
  swapItems = defaultSwapItems,
  dragSlotPitch = DEFAULT_DRAG_SLOT_PITCH,
  onReorder,
}: UseDirectListReorderOptions<T>): DirectListReorderResult<T> {
  const [items, setItemsState] = useState<T[]>(() => [...initialItems]);
  const [dragState, setDragState] = useState<DirectListReorderDragState | null>(null);
  const [isHandleActive, setIsHandleActive] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const itemsRef = useRef<T[]>([...initialItems]);
  const dragStateRef = useRef<DirectListReorderDragState | null>(null);
  const pressStartPageYRef = useRef(0);
  const slotLayoutsRef = useRef<Record<number, SlotLayout>>({});

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
    dragY.setValue(0);
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
    slotLayoutsRef.current[index] = {
      centerY: y + height / 2,
    };
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

  function recordTouchStart(pageY: number) {
    pressStartPageYRef.current = pageY;
    setIsHandleActive(true);
  }

  function beginDrag(index: number) {
    if (!canDragIndex(index)) {
      return false;
    }

    dragY.setValue(0);
    setCurrentDragState({ fromIndex: index, overIndex: index });
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

    const measuredOverIndex = getMeasuredOverIndex(current.fromIndex, dy);
    const offset = Math.round(dy / dragSlotPitch);
    const overIndex =
      measuredOverIndex ??
      Math.max(0, Math.min(itemsRef.current.length - 1, current.fromIndex + offset));

    if (current.overIndex !== overIndex) {
      setCurrentDragState({ ...current, overIndex });
      if (canDropIndex(overIndex)) {
        triggerDragSlotHaptic();
      }
    }
  }

  function getMeasuredOverIndex(fromIndex: number, dy: number) {
    const sourceCenter = slotLayoutsRef.current[fromIndex]?.centerY;
    if (sourceCenter == null) {
      return null;
    }

    const draggedCenter = sourceCenter + dy;
    let closestIndex: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < itemsRef.current.length; index += 1) {
      const centerY = slotLayoutsRef.current[index]?.centerY;
      if (centerY == null) {
        continue;
      }

      const distance = Math.abs(centerY - draggedCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }

    return closestIndex;
  }

  function finishDrag() {
    const current = dragStateRef.current;
    setIsHandleActive(false);
    dragY.setValue(0);
    setCurrentDragState(null);

    if (!current) {
      return null;
    }

    applySwap(current.fromIndex, current.overIndex);
    return current;
  }

  function cancelDrag() {
    setIsHandleActive(false);
    dragY.setValue(0);
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
    isHandleActive,
    canDragIndex,
    canDropIndex,
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
