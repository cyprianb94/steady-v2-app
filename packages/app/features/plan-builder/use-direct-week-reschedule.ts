import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import {
  detectHardSessionConflicts,
  swapSessions,
  type HardSessionConflict,
  type PlannedSession,
  type SwapLogEntry,
} from '@steady/types';

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
  conflicts: HardSessionConflict[];
  hasChanges: boolean;
  movedDayIndexes: Set<number>;
  canDragIndex: (index: number) => boolean;
  canDropIndex: (index: number) => boolean;
  recordTouchStart: (pageY: number) => void;
  beginDrag: (index: number) => boolean;
  updateDrag: (pageY: number) => void;
  finishDrag: () => void;
  cancelDrag: () => void;
  replaceDay: (index: number, session: PlannedSession | null) => void;
  replaceSessions: (nextSessions: (PlannedSession | null)[]) => void;
  restoreDraft: (nextSessions: (PlannedSession | null)[], nextSwapLog?: SwapLogEntry[]) => void;
  reset: () => void;
}

const DEFAULT_DRAG_SLOT_PITCH = 58;

export function useDirectWeekReschedule({
  initialSessions,
  canDragDay = (session) => Boolean(session),
  canDropDay = (session) => !session?.actualActivityId,
  dragSlotPitch = DEFAULT_DRAG_SLOT_PITCH,
}: UseDirectWeekRescheduleOptions): DirectWeekRescheduleResult {
  const [sessions, setSessions] = useState<(PlannedSession | null)[]>(initialSessions);
  const [swapLog, setSwapLog] = useState<SwapLogEntry[]>([]);
  const [dragState, setDragState] = useState<WeekRescheduleDragState | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStateRef = useRef<WeekRescheduleDragState | null>(null);
  const pressStartPageYRef = useRef(0);

  function setCurrentDragState(nextDragState: WeekRescheduleDragState | null) {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function restoreDraft(nextSessions: (PlannedSession | null)[], nextSwapLog: SwapLogEntry[] = []) {
    setSessions(nextSessions);
    setSwapLog(nextSwapLog);
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
  }

  function beginDrag(index: number) {
    if (!canDragIndex(index)) {
      return false;
    }

    dragY.setValue(0);
    setCurrentDragState({ fromIndex: index, overIndex: index });
    return true;
  }

  function updateDrag(pageY: number) {
    const current = dragStateRef.current;
    if (!current) {
      return;
    }

    const dy = pageY - pressStartPageYRef.current;
    dragY.setValue(dy);

    const offset = Math.round(dy / dragSlotPitch);
    const overIndex = Math.max(0, Math.min(sessions.length - 1, current.fromIndex + offset));

    if (current.overIndex !== overIndex) {
      setCurrentDragState({ ...current, overIndex });
    }
  }

  function finishDrag() {
    const current = dragStateRef.current;
    dragY.setValue(0);
    setCurrentDragState(null);

    if (!current) {
      return;
    }

    applySwap(current.fromIndex, current.overIndex);
  }

  function cancelDrag() {
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
    conflicts,
    hasChanges: swapLog.length > 0,
    movedDayIndexes,
    canDragIndex,
    canDropIndex,
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
