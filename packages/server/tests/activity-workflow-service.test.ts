import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity, PlannedSession, TrainingPlan } from '@steady/types';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryNiggleRepo } from '../src/repos/niggle-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { createActivityWorkflowService } from '../src/services/activity-workflow-service';

function makeActivity(userId: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id: crypto.randomUUID(),
    userId,
    source: 'strava',
    externalId: `ext-${crypto.randomUUID().slice(0, 8)}`,
    startTime: '2026-04-05T07:00:00Z',
    distance: 12,
    duration: 3600,
    avgPace: 300,
    splits: [{ km: 1, pace: 300 }],
    ...overrides,
  };
}

function makeSession(id: string, overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id,
    type: 'EASY',
    date: '2026-04-05',
    distance: 8,
    pace: '5:20',
    ...overrides,
  };
}

function makePlan(sessionAActivityId?: string, sessionBActivityId?: string): TrainingPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    raceName: 'London Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:30',
    phases: { BASE: 3, BUILD: 8, RECOVERY: 2, PEAK: 1, TAPER: 2 },
    progressionPct: 7,
    templateWeek: [],
    weeks: [
      {
        weekNumber: 1,
        phase: 'BUILD',
        plannedKm: 16,
        sessions: [
          makeSession('session-a', { actualActivityId: sessionAActivityId }),
          makeSession('session-b', { date: '2026-04-06', actualActivityId: sessionBActivityId }),
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ],
    activeInjury: null,
  };
}

class FlakyPlanRepo extends InMemoryPlanRepo {
  private shouldFail = false;

  armFailure() {
    this.shouldFail = true;
  }

  override async updateWeeks(planId: string, weeks: TrainingPlan['weeks']) {
    if (this.shouldFail) {
      this.shouldFail = false;
      return null;
    }

    return super.updateWeeks(planId, weeks);
  }
}

describe('activity workflow service', () => {
  let activityRepo: InMemoryActivityRepo;
  let planRepo: FlakyPlanRepo;
  let workflow: ReturnType<typeof createActivityWorkflowService>;

  beforeEach(() => {
    activityRepo = new InMemoryActivityRepo();
    planRepo = new FlakyPlanRepo();
    workflow = createActivityWorkflowService({
      activityRepo,
      planRepo,
      niggleRepo: new InMemoryNiggleRepo(activityRepo),
    });
  });

  it('rolls back manual match changes when the plan write fails', async () => {
    const activity = await activityRepo.save(makeActivity('user-1'));
    await planRepo.save(makePlan());
    planRepo.armFailure();

    await expect(
      workflow.matchSession('user-1', {
        activityId: activity.id,
        sessionId: 'w1d0',
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update plan match state',
    });

    expect(await activityRepo.getById(activity.id)).not.toHaveProperty('matchedSessionId');

    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: undefined,
    });
  });
});
