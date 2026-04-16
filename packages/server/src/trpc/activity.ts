import { z } from 'zod';
import {
  BODY_PARTS,
  NIGGLE_SEVERITIES,
  NIGGLE_WHEN_OPTIONS,
} from '@steady/types';
import type { ActivityWorkflowService } from '../services/activity-workflow-service';
import { authedProcedure, router } from './trpc';

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

export function createActivityRouter(activityWorkflow: ActivityWorkflowService) {
  return router({
    list: authedProcedure.query(({ ctx }) => activityWorkflow.listActivities(ctx.userId)),

    matchSession: authedProcedure
      .input(
        z.object({
          activityId: z.string().min(1),
          sessionId: z.string().min(1).nullable(),
        }),
      )
      .mutation(({ ctx, input }) => activityWorkflow.matchSession(ctx.userId, input)),

    saveRunDetail: authedProcedure
      .input(SaveRunDetailSchema)
      .mutation(({ ctx, input }) => activityWorkflow.saveRunDetail(ctx.userId, input)),
  });
}
