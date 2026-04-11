export type {
  SessionType,
  PlannedSession,
  RecoveryDuration,
  SubjectiveBreathing,
  SubjectiveInput,
  SubjectiveLegs,
  SubjectiveOverall,
} from './session';
export { RECOVERY_KM } from './session';

export type {
  PhaseConfig,
  PhaseName,
  PlanWeek,
  SwapLogEntry,
  TrainingPlan,
  TrainingPlanWithAnnotation,
} from './plan';

export type {
  Injury,
  InjuryUpdate,
  CrossTrainingEntry,
  CrossTrainingLogInput,
  CrossTrainingType,
} from './injury';
export { CROSS_TRAINING_TYPES } from './injury';

export type {
  Activity,
  ActivitySplit,
} from './activity';

export type { IntegrationToken } from './integration-token';
export type { StravaSyncMatchSummary, StravaSyncResult } from './strava';

export type {
  ConversationType,
  CoachConversation,
  CoachMessage,
  PlanEdit,
  PlanEditStatus,
} from './coach';

export type { User } from './user';

// Shared pure functions (used by both server and app)
export { sessionKm, expectedDistance, weekKm } from './lib/session-km';
export { generatePlan, defaultPhases } from './lib/plan-generator';
export { propagateChange } from './lib/propagate-change';
export type { PropagateScope } from './lib/propagate-change';
export { getRtrProgression, RTR_STEPS } from './lib/rtr-progression';
export { getDisplayWeekIndex } from './lib/plan-current-week';
export { buildBlockPhaseSegments, getInjuryWeekRange, isInjuryWeek } from './lib/block-injury';
export { getBlockVolumeTone, getWeekVolumeRatio, getWeekVolumeSummary } from './lib/block-volume';
export { buildBlockWeekDayDetails } from './lib/block-week-detail';
export { assignDates } from './lib/assign-dates';
export { detectHardSessionConflicts, propagateSwap, swapSessions } from './lib/session-rearrange';
export {
  DISTANCE_SHORT_PCT,
  DISTANCE_TOLERANCE_PCT,
  HR_ZONE2_MAX_BPM,
  PACE_FAST_SEC,
  PACE_SLOW_SEC,
  summariseVsPlan,
} from './plan-vs-actual';
export type { HardSessionConflict } from './lib/session-rearrange';
export type {
  RtrStepDefinition,
  RtrProgressionStep,
  RtrProgression,
} from './lib/rtr-progression';
export type { BlockPhaseSegment, InjuryWeekRange } from './lib/block-injury';
export type { BlockVolumeTone, WeekVolumeSummary } from './lib/block-volume';
export type { BlockDayStatus, BlockWeekDayDetail } from './lib/block-week-detail';
export type {
  PvaHeadline,
  PvaResult,
  PvaRow,
  PvaVerdict,
  PvaVerdictKind,
  PvaVerdictStatus,
} from './plan-vs-actual';
