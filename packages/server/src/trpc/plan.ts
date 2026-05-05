import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from './trpc';
import {
  EFFORT_CUES,
  INTENSITY_TARGET_MODES,
  INTENSITY_TARGET_SOURCES,
  RUN_STRUCTURE_SEGMENT_KINDS,
  TRAINING_PACE_PROFILE_BAND_ORDER,
  TRAINING_PACE_PROFILE_KEYS,
} from '@steady/types';
import type { PhaseConfig, PlannedSession, PlanWeek } from '@steady/types';
import { PlanWorkflowError, type PlanWorkflowService } from '../services/plan-workflow-service';

const PhaseConfigSchema = z.object({
  BASE: z.number().min(0),
  BUILD: z.number().min(0),
  RECOVERY: z.number().min(0),
  PEAK: z.number().min(0),
  TAPER: z.number().min(0),
});

const InjuryUpdateSchema = z.object({
  reassessedTarget: z.string().min(1).max(100).optional(),
  rtrStep: z.number().min(0).max(4).optional(),
  rtrStepCompletedDates: z.array(z.string()).optional(),
  status: z.enum(['recovering', 'returning', 'resolved']).optional(),
});

const PhaseNameSchema = z.enum(['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER']);
const SessionTypeSchema = z.enum(['EASY', 'INTERVAL', 'TEMPO', 'LONG', 'RECOVERY', 'REST']);
const RecoveryDurationSchema = z.enum(['45s', '60s', '90s', '2min', '3min', '4min', '5min']);
const SessionDurationSchema = z.object({
  unit: z.enum(['km', 'min']),
  value: z.number().positive(),
});
const IntervalRecoverySchema = z.union([RecoveryDurationSchema, SessionDurationSchema]);
const SessionDurationInputSchema = z.union([z.number().positive(), SessionDurationSchema]);
const PaceRangeSchema = z.object({
  min: z.string(),
  max: z.string(),
});
const IntensityTargetSchema = z.object({
  source: z.enum(INTENSITY_TARGET_SOURCES),
  mode: z.enum(INTENSITY_TARGET_MODES),
  profileKey: z.enum(TRAINING_PACE_PROFILE_KEYS).optional(),
  pace: z.string().optional(),
  paceRange: PaceRangeSchema.optional(),
  effortCue: z.enum(EFFORT_CUES).optional(),
});
const RunStructureVolumeSchema = z.object({
  unit: z.enum(['km', 'min', 'sec']),
  value: z.number().positive(),
});
const RunStructureProgressionSchema = z.object({
  from: IntensityTargetSchema.optional(),
  to: IntensityTargetSchema.optional(),
});
const RunStructureSegmentSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(RUN_STRUCTURE_SEGMENT_KINDS),
  volume: RunStructureVolumeSchema,
  intensityTarget: IntensityTargetSchema.optional(),
  progression: RunStructureProgressionSchema.optional(),
  note: z.string().optional(),
});
const RunStructureRepeatSchema = z.object({
  id: z.string().optional(),
  kind: z.literal('REPEAT'),
  repeats: z.number().int().positive(),
  segments: z.array(RunStructureSegmentSchema).min(1),
  note: z.string().optional(),
});
const RunStructureSchema = z.object({
  items: z.array(z.union([RunStructureSegmentSchema, RunStructureRepeatSchema])).min(1),
});
const TrainingPaceProfileBandEditabilitySchema = z.union([
  z.object({ editable: z.literal(true) }),
  z.object({
    editable: z.literal(false),
    reason: z.literal('race-target-derived'),
  }),
]);
const TrainingPaceProfileBandSchema = z.object({
  profileKey: z.enum(TRAINING_PACE_PROFILE_KEYS),
  label: z.string(),
  order: z.number(),
  pace: z.string().optional(),
  paceRange: PaceRangeSchema.optional(),
  defaultEffortCue: z.enum(EFFORT_CUES),
  editability: TrainingPaceProfileBandEditabilitySchema,
});
const TrainingPaceProfileBandsSchema = z.object(
  TRAINING_PACE_PROFILE_BAND_ORDER.reduce((shape, profileKey) => {
    shape[profileKey] = TrainingPaceProfileBandSchema;
    return shape;
  }, {} as Record<typeof TRAINING_PACE_PROFILE_BAND_ORDER[number], typeof TrainingPaceProfileBandSchema>),
);
const TrainingPaceProfileSchema = z.object({
  raceDistance: z.enum(['5K', '10K', 'Half Marathon', 'Marathon', 'Ultra']),
  targetTime: z.string(),
  targetTimeSeconds: z.number().positive(),
  racePace: z.string(),
  bands: TrainingPaceProfileBandsSchema,
});
const SubjectiveInputSchema = z.object({
  legs: z.enum(['fresh', 'normal', 'heavy', 'dead']),
  breathing: z.enum(['easy', 'controlled', 'labored']),
  overall: z.enum(['could-go-again', 'done', 'shattered']),
});
const SkippedSessionReasonSchema = z.enum(['tired', 'ill', 'busy', 'sore', 'other']);
const SkippedSessionSchema = z.object({
  reason: SkippedSessionReasonSchema,
  markedAt: z.string(),
});
const PlannedSessionSchema = z.object({
  id: z.string(),
  type: SessionTypeSchema,
  date: z.string(),
  distance: z.number().optional(),
  pace: z.string().optional(),
  intensityTarget: IntensityTargetSchema.optional(),
  plannedVolume: SessionDurationSchema.optional(),
  planNote: z.string().optional(),
  runStructure: RunStructureSchema.optional(),
  reps: z.number().int().optional(),
  repDist: z.number().int().optional(),
  repDuration: SessionDurationSchema.optional(),
  recovery: IntervalRecoverySchema.optional(),
  warmup: SessionDurationInputSchema.optional(),
  cooldown: SessionDurationInputSchema.optional(),
  actualActivityId: z.string().optional(),
  subjectiveInput: SubjectiveInputSchema.optional(),
  subjectiveInputDismissed: z.boolean().optional(),
  skipped: SkippedSessionSchema.optional(),
});
const PlanWeekSchema = z.object({
  weekNumber: z.number().int().min(1),
  phase: PhaseNameSchema,
  sessions: z.array(PlannedSessionSchema.nullable()).length(7),
  plannedKm: z.number(),
  swapLog: z.array(z.object({
    from: z.number().int().min(0),
    to: z.number().int().min(0),
  })).optional(),
});

async function runWorkflow<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PlanWorkflowError) {
      throw new TRPCError({
        code: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}

export function createPlanRouter(planWorkflow: PlanWorkflowService) {
  return router({
    /** Get the user's active training plan. */
    get: authedProcedure.query(async ({ ctx }) => {
      return planWorkflow.getActivePlan(ctx.userId);
    }),

    /** Read the stored training pace profile for the user's active plan. */
    getTrainingPaceProfile: authedProcedure.query(async ({ ctx }) => {
      return planWorkflow.getTrainingPaceProfile(ctx.userId);
    }),

    /** Persist the training pace profile on the user's active plan. */
    updateTrainingPaceProfile: authedProcedure
      .input(
        z.object({
          trainingPaceProfile: TrainingPaceProfileSchema.nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return planWorkflow.updateTrainingPaceProfile(ctx.userId, input.trainingPaceProfile);
      }),

    /** Generate a plan server-side from a template. */
    generate: authedProcedure
      .input(
        z.object({
          template: z.array(z.any()),
          totalWeeks: z.number().min(4).max(52),
          progressionPct: z.number().min(0).max(30),
          progressionEveryWeeks: z.number().min(1).max(12).optional(),
          phases: PhaseConfigSchema.optional(),
        }),
      )
      .mutation(({ input }) => {
        return planWorkflow.generatePlan({
          template: input.template as (PlannedSession | null)[],
          totalWeeks: input.totalWeeks,
          progressionPct: input.progressionPct,
          progressionEveryWeeks: input.progressionEveryWeeks,
          phases: input.phases as PhaseConfig | undefined,
        });
      }),

    /** Save or update a training plan with validation. */
    save: authedProcedure
      .input(
        z.object({
          raceName: z.string().min(1).max(200),
          raceDate: z.string(),
          raceDistance: z.enum(['5K', '10K', 'Half Marathon', 'Marathon', 'Ultra']),
          targetTime: z.string(),
          phases: PhaseConfigSchema,
          progressionPct: z.number().min(0).max(30),
          progressionEveryWeeks: z.number().min(1).max(12).optional(),
          trainingPaceProfile: TrainingPaceProfileSchema.nullable().optional(),
          templateWeek: z.array(z.any()),
          weeks: z.array(PlanWeekSchema),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.savePlan(ctx.userId, {
          raceName: input.raceName,
          raceDate: input.raceDate,
          raceDistance: input.raceDistance,
          targetTime: input.targetTime,
          phases: input.phases,
          progressionPct: input.progressionPct,
          progressionEveryWeeks: input.progressionEveryWeeks,
          trainingPaceProfile: input.trainingPaceProfile,
          templateWeek: input.templateWeek as (PlannedSession | null)[],
          weeks: input.weeks as PlanWeek[],
        }));
      }),

    /** Apply a session edit and propagate across the plan. */
    propagate: authedProcedure
      .input(
        z.object({
          weekIndex: z.number().min(0),
          dayIndex: z.number().min(0).max(6),
          updated: z.any(),
          scope: z.enum(['this', 'remaining', 'build']),
          targetPhase: PhaseNameSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.propagatePlanChange(ctx.userId, {
          weekIndex: input.weekIndex,
          dayIndex: input.dayIndex,
          updated: input.updated as PlannedSession | null,
          scope: input.scope,
          targetPhase: input.targetPhase,
        }));
      }),

    /** Update a single week's sessions (used by propagateChange on client). */
    updateWeeks: authedProcedure
      .input(
        z.object({
          weeks: z.array(PlanWeekSchema),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.updateWeeks(ctx.userId, input.weeks as PlanWeek[]));
      }),

    markSessionSkipped: authedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          reason: SkippedSessionReasonSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.markSessionSkipped(ctx.userId, input));
      }),

    clearSessionSkipped: authedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.clearSessionSkipped(ctx.userId, input));
      }),

    markInjury: authedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.markInjury(ctx.userId, input.name));
      }),

    updateInjury: authedProcedure
      .input(InjuryUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        return runWorkflow(() => planWorkflow.updateInjury(ctx.userId, input));
      }),

    clearInjury: authedProcedure
      .mutation(async ({ ctx }) => {
        return runWorkflow(() => planWorkflow.clearInjury(ctx.userId));
      }),
  });
}
