import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  BODY_PARTS,
  NIGGLE_SEVERITIES,
  NIGGLE_WHEN_OPTIONS,
  type PlanWeek,
  type TrainingPlan,
} from '@steady/types';
import type { ActivityRepo } from '../repos/activity-repo';
import type { NiggleInput, NiggleRepo } from '../repos/niggle-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ShoeRepo } from '../repos/shoe-repo';
import { authedProcedure, router } from './trpc';
import { applyActivityMatchToPlan } from '../lib/activity-match-assignment';

const SubjectiveInputSchema = z.object({
  legs: z.enum(['fresh', 'normal', 'heavy', 'dead']),
  breathing: z.enum(['easy', 'controlled', 'labored']),
  overall: z.enum(['could-go-again', 'done', 'shattered']),
});

const NiggleInputSchema = z.object({
  bodyPart: z.enum(BODY_PARTS),
  severity: z.enum(NIGGLE_SEVERITIES),
  when: z.enum(NIGGLE_WHEN_OPTIONS),
  side: z.enum(['left', 'right']).nullable(),
});

const SaveRunDetailSchema = z.object({
  activityId: z.string().uuid(),
  subjectiveInput: SubjectiveInputSchema,
  niggles: z.array(NiggleInputSchema),
  notes: z.string().optional(),
  shoeId: z.string().min(1).nullable().optional(),
  matchedSessionId: z.string().nullable().optional(),
});

function cloneWeeks(weeks: PlanWeek[]): PlanWeek[] {
  return structuredClone(weeks);
}

function stripNigglePersistenceFields(niggle: {
  bodyPart: NiggleInput['bodyPart'];
  severity: NiggleInput['severity'];
  when: NiggleInput['when'];
  side: NiggleInput['side'];
}): NiggleInput {
  return {
    bodyPart: niggle.bodyPart,
    severity: niggle.severity,
    when: niggle.when,
    side: niggle.side,
  };
}

function buildUpdatedWeeks(plan: TrainingPlan, activityId: string, nextSessionId: string | null): PlanWeek[] {
  if (!nextSessionId) {
    return plan.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) => {
        if (!session || session.actualActivityId !== activityId) return session;
        return { ...session, actualActivityId: undefined };
      }),
    }));
  }

  let foundTarget = false;

  const weeks = plan.weeks.map((week) => ({
    ...week,
    sessions: week.sessions.map((session) => {
      if (!session) return session;

      if (session.id === nextSessionId) {
        foundTarget = true;

        if (session.actualActivityId && session.actualActivityId !== activityId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Target session is already linked to another activity',
          });
        }

        return { ...session, actualActivityId: activityId };
      }

      if (session.actualActivityId === activityId) {
        return { ...session, actualActivityId: undefined };
      }

      return session;
    }),
  }));

  if (!foundTarget) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Could not find matched session ${nextSessionId} in the active plan`,
    });
  }

  return weeks;
}

async function validateShoeOwnership(shoeRepo: ShoeRepo | undefined, userId: string, shoeId: string | null | undefined) {
  if (!shoeRepo || !shoeId) return;

  const shoes = await shoeRepo.listByUserId(userId);
  if (!shoes.some((shoe) => shoe.id === shoeId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Selected shoe does not belong to the authenticated user',
    });
  }
}

export function createActivityRouter(
  activityRepo: ActivityRepo,
  planRepo: PlanRepo,
  niggleRepo: NiggleRepo,
  shoeRepo?: ShoeRepo,
) {
  return router({
    list: authedProcedure.query(async ({ ctx }) => {
      const activities = await activityRepo.getByUserId(ctx.userId);
      return activities.sort((a, b) => b.startTime.localeCompare(a.startTime));
    }),

    matchSession: authedProcedure
      .input(
        z.object({
          activityId: z.string().min(1),
          sessionId: z.string().min(1).nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const activities = await activityRepo.getByUserId(ctx.userId);
        const activity = activities.find((item) => item.id === input.activityId);

        if (!activity) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
        }

        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        const assignment = applyActivityMatchToPlan(plan, activity.id, input.sessionId);
        if (!assignment.foundSession) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }
        if (assignment.conflictingSession) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Session already has a matched activity',
          });
        }

        const updatedActivity = await activityRepo.updateMatchedSession(activity.id, input.sessionId);
        if (!updatedActivity) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
        }

        const updatedPlan = await planRepo.updateWeeks(plan.id, assignment.plan.weeks);
        if (!updatedPlan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        return {
          activity: updatedActivity,
          plan: updatedPlan,
        };
      }),

    saveRunDetail: authedProcedure
      .input(SaveRunDetailSchema)
      .mutation(async ({ ctx, input }) => {
        const existingActivity = await activityRepo.getById(input.activityId);
        if (!existingActivity || existingActivity.userId !== ctx.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
        }

        await validateShoeOwnership(shoeRepo, ctx.userId, input.shoeId);

        const previousActivity = structuredClone(existingActivity);
        const previousNiggles = await niggleRepo.listByActivity(input.activityId);

        const shouldUpdateMatch = input.matchedSessionId !== undefined;
        const activePlan = shouldUpdateMatch ? await planRepo.getActive(ctx.userId) : null;
        const previousWeeks = activePlan ? cloneWeeks(activePlan.weeks) : null;
        const nextWeeks = shouldUpdateMatch
          ? buildUpdatedWeeks(
              activePlan ?? (() => {
                throw new TRPCError({
                  code: 'NOT_FOUND',
                  message: 'No active plan found for the requested match change',
                });
              })(),
              input.activityId,
              input.matchedSessionId ?? null,
            )
          : null;

        try {
          const notes = input.notes?.trim() ? input.notes.trim() : null;

          const afterSubjective = await activityRepo.updateSubjectiveInput(input.activityId, input.subjectiveInput);
          if (!afterSubjective) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during subjective update' });
          }

          const afterNotes = await activityRepo.updateNotes(input.activityId, notes);
          if (!afterNotes) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during notes update' });
          }

          const afterShoe = await activityRepo.setShoe(input.activityId, input.shoeId ?? null);
          if (!afterShoe) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during shoe update' });
          }

          const savedNiggles = await niggleRepo.setForActivity(input.activityId, input.niggles);

          if (shouldUpdateMatch && activePlan && nextWeeks) {
            const updatedPlan = await planRepo.updateWeeks(activePlan.id, nextWeeks);
            if (!updatedPlan) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update plan match state' });
            }

            const matchedActivity = await activityRepo.updateMatchedSession(input.activityId, input.matchedSessionId ?? null);
            if (!matchedActivity) {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during match update' });
            }
          }

          const savedActivity = await activityRepo.getById(input.activityId);
          if (!savedActivity) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity missing after save' });
          }

          return {
            activity: savedActivity,
            niggles: savedNiggles,
          };
        } catch (error) {
          await activityRepo.save(previousActivity);
          await niggleRepo.setForActivity(
            input.activityId,
            previousNiggles.map(stripNigglePersistenceFields),
          );

          if (activePlan && previousWeeks) {
            await planRepo.updateWeeks(activePlan.id, previousWeeks);
          }

          throw error;
        }
      }),
  });
}
