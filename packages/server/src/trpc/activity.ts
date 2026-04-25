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

const NiggleWhenSchema = z.union([
  z.enum(NIGGLE_WHEN_OPTIONS).transform((value) => [value]),
  z.array(z.enum(NIGGLE_WHEN_OPTIONS))
    .min(1)
    .max(NIGGLE_WHEN_OPTIONS.length)
    .refine((values) => new Set(values).size === values.length, 'Choose each when option once')
    .transform((values) => NIGGLE_WHEN_OPTIONS.filter((option) => values.includes(option))),
]);

const NiggleInputSchema = z.object({
  bodyPart: z.enum(BODY_PARTS),
  bodyPartOtherText: z.string().trim().min(1).max(NIGGLE_OTHER_BODY_PART_MAX_LENGTH).optional().nullable(),
  severity: z.enum(NIGGLE_SEVERITIES),
  when: NiggleWhenSchema,
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

const FuelGelSchema = z.object({
  id: z.string().min(1).max(160),
  brand: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  flavour: z.string().trim().min(1).max(120),
  caloriesKcal: z.number().int().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable(),
  caffeineMg: z.number().int().nonnegative().nullable(),
  sodiumMg: z.number().int().nonnegative().nullable(),
  potassiumMg: z.number().int().nonnegative().nullable(),
  magnesiumMg: z.number().int().nonnegative().nullable(),
  imageUrl: z.string().trim().url().nullable(),
  notes: z.string().trim().max(500).optional(),
});

const FuelEventSchema = z.object({
  id: z.string().min(1).max(80),
  minute: z.number().int().nonnegative(),
  gel: FuelGelSchema,
});

const SaveRunDetailSchema = z.object({
  activityId: z.string().uuid(),
  subjectiveInput: SubjectiveInputSchema,
  niggles: z.array(NiggleInputSchema),
  notes: z.string().optional(),
  shoeId: z.string().min(1).nullable().optional(),
  fuelEvents: z.array(FuelEventSchema).max(50).optional(),
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
