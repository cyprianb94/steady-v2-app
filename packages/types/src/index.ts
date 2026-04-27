export type {
  SessionType,
  PlannedSession,
  SessionDurationSpec,
  SessionDurationUnit,
  RecoveryDuration,
  IntervalRecovery,
  SubjectiveBreathing,
  SubjectiveInput,
  SubjectiveLegs,
  SubjectiveOverall,
  SkippedSession,
  SkippedSessionReason,
} from './session';
export {
  RECOVERY_KM,
  RECOVERY_KM_PER_MIN,
  normalizeSessionDuration,
  sessionDurationKm,
  sessionSupportsWarmupCooldown,
} from './session';

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
export {
  BODY_PART_LABELS,
  BODY_PARTS,
  NIGGLE_OTHER_BODY_PART_MAX_LENGTH,
  NIGGLE_SEVERITIES,
  NIGGLE_WHEN_OPTIONS,
  formatNiggleBodyPart,
  formatNiggleWhen,
  formatNiggleSummary,
  normalizeNiggleWhen,
} from './niggle';
export type {
  BodyPart,
  Niggle,
  NiggleSeverity,
  NiggleSide,
  NiggleWhen,
  NiggleWhenValue,
} from './niggle';

export type {
  Activity,
  ActivitySplit,
  RunFuelEvent,
  RunFuelGel,
} from './activity';
export type { Shoe } from './shoe';
export { shoeLifetimeKm } from './shoe';

export type { IntegrationToken } from './integration-token';
export type { StravaSyncMatchSummary, StravaSyncResult } from './strava';

export type {
  ConversationType,
  CoachConversation,
  CoachMessage,
  PlanEdit,
  PlanEditStatus,
} from './coach';

export type { User, WeeklyVolumeMetric } from './user';

// Shared pure functions (used by both server and app)
export { sessionKm, expectedDistance, weekKm } from './lib/session-km';
export {
  buildWeeklyVolumeSummary,
  getWeeklyVolumeDayMetric,
} from './lib/weekly-volume';
export type {
  BuildWeeklyVolumeSummaryInput,
  WeeklyVolumeDay,
  WeeklyVolumeDayStatus,
  WeeklyVolumeMetricValues,
  WeeklyVolumeSummary,
} from './lib/weekly-volume';
export { generatePlan, defaultPhases } from './lib/plan-generator';
export {
  normalizePlanWeekSessionDurations,
  normalizeSessionDurations,
  normalizeTrainingPlanSessionDurations,
} from './lib/normalize-session-durations';
export { propagateChange } from './lib/propagate-change';
export type { PropagateScope } from './lib/propagate-change';
export { getRtrProgression, RTR_STEPS } from './lib/rtr-progression';
export { getDisplayWeekIndex } from './lib/plan-current-week';
export { addDaysIso, assignWeekSessionDates, inferWeekStartDate, startOfWeekIso } from './lib/week-dates';
export { buildBlockPhaseSegments, getInjuryWeekRange, isInjuryWeek } from './lib/block-injury';
export { getBlockVolumeTone, getWeekVolumeRatio, getWeekVolumeSummary } from './lib/block-volume';
export { buildBlockWeekDayDetails } from './lib/block-week-detail';
export { assignDates } from './lib/assign-dates';
export { normalizeSessionIds } from './lib/normalize-session-ids';
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
