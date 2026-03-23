import { router } from './trpc';
import { planRouter } from './plan';
import { coachRouter } from './coach';

export const appRouter = router({
  plan: planRouter,
  coach: coachRouter,
});

export type AppRouter = typeof appRouter;
