import { TRPCError } from '@trpc/server';
import type { Activity, Niggle, SubjectiveInput, TrainingPlan } from '@steady/types';
import { applyActivityMatchToPlan } from '../lib/activity-match-assignment';
import type { ActivityRepo } from '../repos/activity-repo';
import type { NiggleInput, NiggleRepo } from '../repos/niggle-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ShoeRepo } from '../repos/shoe-repo';
import { repairOrphanedActivityLinks } from './orphaned-activity-link-repair';

/**
 * Workflow boundary for activity save and manual match changes.
 *
 * Routers validate/authenticate. This service owns multi-step repo writes,
 * rollback, and the rules for how activity state and plan match state move
 * together.
 */
export interface MatchSessionInput {
  activityId: string;
  sessionId: string | null;
}

export interface SaveRunDetailInput {
  activityId: string;
  subjectiveInput: SubjectiveInput;
  niggles: NiggleInput[];
  notes?: string;
  shoeId?: string | null;
  matchedSessionId?: string | null;
}

export interface ActivityWorkflowService {
  getActivity(userId: string, activityId: string): Promise<Activity | null>;
  listActivities(userId: string): Promise<Activity[]>;
  matchSession(userId: string, input: MatchSessionInput): Promise<{ activity: Activity; plan: TrainingPlan }>;
  saveRunDetail(userId: string, input: SaveRunDetailInput): Promise<{ activity: Activity; niggles: Niggle[] }>;
}

interface ActivityWorkflowServiceDeps {
  activityRepo: ActivityRepo;
  planRepo: PlanRepo;
  niggleRepo: NiggleRepo;
  shoeRepo?: ShoeRepo;
}

function stripNigglePersistenceFields(niggle: Niggle): NiggleInput {
  return {
    bodyPart: niggle.bodyPart,
    bodyPartOtherText: niggle.bodyPartOtherText,
    severity: niggle.severity,
    when: niggle.when,
    side: niggle.side,
  };
}

async function getOwnedActivity(
  activityRepo: ActivityRepo,
  userId: string,
  activityId: string,
  missingMessage = 'Activity not found',
): Promise<Activity> {
  const activity = await activityRepo.getById(activityId);
  if (!activity || activity.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: missingMessage });
  }
  return activity;
}

function applyPlanMatchOrThrow(
  plan: TrainingPlan,
  activityId: string,
  sessionId: string | null,
  sessionMissingMessage: string,
  conflictMessage: string,
): TrainingPlan {
  const assignment = applyActivityMatchToPlan(plan, activityId, sessionId);
  if (!assignment.foundSession) {
    throw new TRPCError({ code: 'NOT_FOUND', message: sessionMissingMessage });
  }
  if (assignment.conflictingSession) {
    throw new TRPCError({ code: 'CONFLICT', message: conflictMessage });
  }
  return assignment.plan;
}

async function validateShoeOwnership(
  shoeRepo: ShoeRepo | undefined,
  userId: string,
  shoeId: string | null | undefined,
): Promise<void> {
  if (!shoeRepo || !shoeId) return;

  const shoes = await shoeRepo.listByUserId(userId);
  if (!shoes.some((shoe) => shoe.id === shoeId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Selected shoe does not belong to the authenticated user',
    });
  }
}

async function updatePlanWeeksOrThrow(
  planRepo: PlanRepo,
  planId: string,
  weeks: TrainingPlan['weeks'],
  failureMessage: string,
): Promise<TrainingPlan> {
  const updatedPlan = await planRepo.updateWeeks(planId, weeks);
  if (!updatedPlan) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: failureMessage });
  }
  return updatedPlan;
}

export function createActivityWorkflowService(deps: ActivityWorkflowServiceDeps): ActivityWorkflowService {
  return {
    async getActivity(userId: string, activityId: string): Promise<Activity | null> {
      const activity = await deps.activityRepo.getById(activityId);
      if (!activity || activity.userId !== userId) {
        await repairOrphanedActivityLinks(userId, deps);
        return null;
      }

      return {
        ...activity,
        niggles: await deps.niggleRepo.listByActivity(activity.id),
      };
    },

    async listActivities(userId: string): Promise<Activity[]> {
      const activities = await deps.activityRepo.getByUserId(userId);
      const activitiesWithNiggles = await Promise.all(
        activities.map(async (activity) => ({
          ...activity,
          niggles: await deps.niggleRepo.listByActivity(activity.id),
        })),
      );

      return activitiesWithNiggles.sort((a, b) => b.startTime.localeCompare(a.startTime));
    },

    async matchSession(userId: string, input: MatchSessionInput): Promise<{ activity: Activity; plan: TrainingPlan }> {
      const activity = await getOwnedActivity(deps.activityRepo, userId, input.activityId);
      const activePlan = await repairOrphanedActivityLinks(userId, deps, {
        plan: await deps.planRepo.getActive(userId),
        strict: true,
      });
      if (!activePlan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
      }

      const nextPlan = applyPlanMatchOrThrow(
        activePlan,
        activity.id,
        input.sessionId,
        'Session not found',
        'Session already has a matched activity',
      );

      const previousActivity = structuredClone(activity);
      const previousWeeks = structuredClone(activePlan.weeks);

      try {
        const updatedPlan = await updatePlanWeeksOrThrow(
          deps.planRepo,
          activePlan.id,
          nextPlan.weeks,
          'Failed to update plan match state',
        );
        const updatedActivity = await deps.activityRepo.updateMatchedSession(activity.id, input.sessionId);
        if (!updatedActivity) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during match update' });
        }

        return {
          activity: updatedActivity,
          plan: updatedPlan,
        };
      } catch (error) {
        await deps.activityRepo.save(previousActivity);
        await deps.planRepo.updateWeeks(activePlan.id, previousWeeks);
        throw error;
      }
    },

    async saveRunDetail(userId: string, input: SaveRunDetailInput): Promise<{ activity: Activity; niggles: Niggle[] }> {
      const existingActivity = await getOwnedActivity(deps.activityRepo, userId, input.activityId);
      await validateShoeOwnership(deps.shoeRepo, userId, input.shoeId);

      const previousActivity = structuredClone(existingActivity);
      const previousNiggles = await deps.niggleRepo.listByActivity(input.activityId);
      const shouldUpdateMatch = input.matchedSessionId !== undefined;
      const activePlan = shouldUpdateMatch
        ? await repairOrphanedActivityLinks(userId, deps, {
          plan: await deps.planRepo.getActive(userId),
          strict: true,
        })
        : null;

      if (shouldUpdateMatch && !activePlan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active plan found for the requested match change',
        });
      }

      const previousWeeks = activePlan ? structuredClone(activePlan.weeks) : null;
      const nextPlan = activePlan
        ? applyPlanMatchOrThrow(
            activePlan,
            input.activityId,
            input.matchedSessionId ?? null,
            `Could not find matched session ${input.matchedSessionId} in the active plan`,
            'Target session is already linked to another activity',
          )
        : null;

      try {
        const notes = input.notes?.trim() ? input.notes.trim() : null;

        const afterSubjective = await deps.activityRepo.updateSubjectiveInput(input.activityId, input.subjectiveInput);
        if (!afterSubjective) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during subjective update' });
        }

        const afterNotes = await deps.activityRepo.updateNotes(input.activityId, notes);
        if (!afterNotes) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during notes update' });
        }

        const afterShoe = await deps.activityRepo.setShoe(input.activityId, input.shoeId ?? null);
        if (!afterShoe) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during shoe update' });
        }

        const savedNiggles = await deps.niggleRepo.setForActivity(input.activityId, input.niggles);

        if (activePlan && nextPlan) {
          await updatePlanWeeksOrThrow(
            deps.planRepo,
            activePlan.id,
            nextPlan.weeks,
            'Failed to update plan match state',
          );
          const matchedActivity = await deps.activityRepo.updateMatchedSession(input.activityId, input.matchedSessionId ?? null);
          if (!matchedActivity) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found during match update' });
          }
        }

        const savedActivity = await deps.activityRepo.getById(input.activityId);
        if (!savedActivity) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity missing after save' });
        }

        return {
          activity: savedActivity,
          niggles: savedNiggles,
        };
      } catch (error) {
        await deps.activityRepo.save(previousActivity);
        await deps.niggleRepo.setForActivity(
          input.activityId,
          previousNiggles.map(stripNigglePersistenceFields),
        );

        if (activePlan && previousWeeks) {
          await deps.planRepo.updateWeeks(activePlan.id, previousWeeks);
        }

        throw error;
      }
    },
  };
}
