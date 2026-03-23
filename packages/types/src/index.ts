export type {
  SessionType,
  PlannedSession,
  RecoveryDuration,
} from './session';
export { RECOVERY_KM } from './session';

export type {
  PhaseConfig,
  PhaseName,
  PlanWeek,
  TrainingPlan,
} from './plan';

export type {
  Activity,
  ActivitySplit,
} from './activity';

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
