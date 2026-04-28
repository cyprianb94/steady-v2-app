import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import {
  detectHardSessionConflicts,
  swapSessions,
  type HardSessionConflict,
  type PlannedSession,
  type SwapLogEntry,
} from '@steady/types';
import { triggerDragSlotHaptic, triggerDragStartHaptic } from '../../lib/haptics';

export interface WeekRescheduleDragState {
  fromIndex: number;
  overIndex: number;
}

interface UseDirectWeekRescheduleOptions {
  initialSessions: (PlannedSession | null)[];
  canDragDay?: (session: PlannedSession | null, index: number) => boolean;
  canDropDay?: (session: PlannedSession | null, index: number) => boolean;
  dragSlotPitch?: number;
}

interface DirectWeekRescheduleResult {
  sessions: (PlannedSession | null)[];
  swapLog: SwapLogEntry[];
  dragState: WeekRescheduleDragState | null;
  dragY: Animated.Value;
  isHandleActive: boolean;
  conflicts: HardSessionConflict[];
  hasChanges: boolean;
  movedDayIndexes: Set<number>;
  canDragIndex: (index: number) => boolean;
  canDropIndex: (index: number) => boolean;
  registerSlotLayout: (index: number, y: number, height: number) => void;
  recordTouchStart: (pageY: number) => void;
  beginDrag: (index: number) => boolean;
  updateDrag: (pageY: number) => void;
  finishDrag: () => WeekRescheduleDragState | null;
  cancelDrag: () => void;
  replaceDay: (index: number, session: PlannedSession | null) => void;
  replaceSessions: (nextSessions: (PlannedSession | null)[]) => void;
  restoreDraft: (nextSessions: (PlannedSession | null)[], nextSwapLog?: SwapLogEntry[]) => void;
  reset: () => void;
}

const DEFAULT_DRAG_SLOT_PITCH = 58;

interface SlotLayout {
  centerY: number;
}

export function useDirectWeekReschedule({
  initialSessions,
  canDragDay = (session) => Boolean(session),
  canDropDay = (session) => !session?.actualActivityId,
  dragSlotPitch = DEFAULT_DRAG_SLOT_PITCH,
}: UseDirectWeekRescheduleOptions): DirectWeekRescheduleResult {
  const [sessions, setSessions] = useState<(PlannedSession | null)[]>(initialSessions);
  const [swapLog, setSwapLog] = useState<SwapLogEntry[]>([]);
  const [dragState, setDragState] = useState<WeekRescheduleDragState | null>(null);
  const [isHandleActive, setIsHandleActive] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStateRef = useRef<WeekRescheduleDragState | null>(null);
  const pressStartPageYRef = useRef(0);
  const slotLayoutsRef = useRef<Record<number, SlotLayout>>({});

  function setCurrentDragState(nextDragState: WeekRescheduleDragState | null) {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function restoreDraft(nextSessions: (PlannedSession | null)[], nextSwapLog: SwapLogEntry[] = []) {
    setSessions(nextSessions);
    setSwapLog(nextSwapLog);
    setIsHandleActive(false);
    dragY.setValue(0);
    setCurrentDragState(null);
  }

  useEffect(() => {
    restoreDraft(initialSessions, []);
  }, [initialSessions]);

  function canDragIndex(index: number) {
    return canDragDay(sessions[index] ?? null, index);
  }

  function canDropIndex(index: number) {
    return canDropDay(sessions[index] ?? null, index);
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

    setSessions((current) => swapSessions(current, fromIndex, toIndex));
    setSwapLog((current) => [...current, { from: fromIndex, to: toIndex }]);
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
      Math.max(0, Math.min(sessions.length - 1, current.fromIndex + offset));

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

    for (let index = 0; index < sessions.length; index += 1) {
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

  function replaceDay(index: number, session: PlannedSession | null) {
    setSessions((current) => {
      const next = [...current];
      next[index] = session;
      return next;
    });
  }

  function replaceSessions(nextSessions: (PlannedSession | null)[]) {
    setSessions(nextSessions);
  }

  function reset() {
    restoreDraft(initialSessions, []);
  }

  const conflicts = useMemo(() => detectHardSessionConflicts(sessions), [sessions]);
  const movedDayIndexes = useMemo(() => {
    const nextIndexes = new Set<number>();

    sessions.forEach((session, index) => {
      const initialId = initialSessions[index]?.id ?? null;
      const currentId = session?.id ?? null;

      if (initialId !== currentId) {
        nextIndexes.add(index);
      }
    });

    return nextIndexes;
  }, [initialSessions, sessions]);

  return {
    sessions,
    swapLog,
    dragState,
    dragY,
    isHandleActive,
    conflicts,
    hasChanges: swapLog.length > 0,
    movedDayIndexes,
    canDragIndex,
    canDropIndex,
    registerSlotLayout,
    recordTouchStart,
    beginDrag,
    updateDrag,
    finishDrag,
    cancelDrag,
    replaceDay,
    replaceSessions,
    restoreDraft,
    reset,
  };
}
