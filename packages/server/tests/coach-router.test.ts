import { describe, expect, it } from 'vitest';
import { STEADY_AI_FREEZE_MESSAGE } from '@steady/types';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

describe('coach router AI freeze', () => {
  it('refuses new Steady AI messages while the freeze is active', async () => {
    const appRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    const caller = appRouter.createCaller({ userId: 'user-1' });

    await expect(caller.coach.send({ message: 'Should I run today?' })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: STEADY_AI_FREEZE_MESSAGE,
    });
  });
});
