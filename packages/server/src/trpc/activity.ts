import { z } from 'zod';
import {
  BODY_PARTS,
  NIGGLE_OTHER_BODY_PART_MAX_LENGTH,
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
  bodyPartOtherText: z.string().trim().min(1).max(NIGGLE_OTHER_BODY_PART_MAX_LENGTH).optional().nullable(),
  severity: z.enum(NIGGLE_SEVERITIES),
  when: z.enum(NIGGLE_WHEN_OPTIONS),
  side: z.enum(['left', 'right']).nullable(),
}).superRefine((value, ctx) => {
  if (value.bodyPart === 'other' && !value.bodyPartOtherText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bodyPartOtherText'],
      message: 'Provide the body part when choosing Other',
    });
  }

  if (value.bodyPart !== 'other' && value.bodyPartOtherText != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bodyPartOtherText'],
      message: 'Custom body-part text is only allowed when choosing Other',
    });
  }
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
    get: authedProcedure
      .input(
        z.object({
          activityId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => activityWorkflow.getActivity(ctx.userId, input.activityId)),

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
