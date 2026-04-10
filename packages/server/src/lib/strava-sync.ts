import type {
  Activity,
  ActivitySplit,
  PlannedSession,
  StravaSyncMatchSummary,
  StravaSyncResult,
  TrainingPlan,
} from '@steady/types';
import { matchActivity } from './activity-matcher';
import type { StravaActivity, StravaClient } from './strava-client';
import type { StravaTokenService } from './strava-token-service';
import type { ActivityRepo } from '../repos/activity-repo';
import type { IntegrationTokenRepo } from '../repos/integration-token-repo';
import type { PlanRepo } from '../repos/plan-repo';

interface SyncStravaActivitiesDeps {
  activityRepo: ActivityRepo;
  integrationTokenRepo: IntegrationTokenRepo;
  planRepo: PlanRepo;
  stravaClient: StravaClient;
  tokenService: StravaTokenService;
  now?: () => Date;
}

function isRunActivity(activity: StravaActivity): boolean {
  const sportType = activity.sport_type ?? activity.type;
  return sportType === 'Run' || sportType === 'TrailRun';
}

function getInitialSyncAfter(plan: TrainingPlan | null, now: Date): string {
  const earliestSessionDate = plan?.weeks
    .flatMap((week) => week.sessions)
    .flatMap((session) => session?.date ? [session.date] : [])
    .sort()[0];

  if (earliestSessionDate) {
    return `${earliestSessionDate}T00:00:00.000Z`;
  }

  return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
}

function mapSplit(split: NonNullable<StravaActivity['splits_metric']>[number]): ActivitySplit {
  const distanceKm = split.distance > 0 ? split.distance / 1000 : 1;
  const derivedPace = split.elapsed_time > 0
    ? Math.round(split.elapsed_time / distanceKm)
    : split.average_speed && split.average_speed > 0
      ? Math.round(1000 / split.average_speed)
      : 0;

  return {
    km: split.split,
    pace: derivedPace,
    hr: split.average_heartrate,
    elevation: split.elevation_difference,
  };
}

function mapActivity(userId: string, activity: StravaActivity): Activity {
  const distanceKm = activity.distance / 1000;
  const duration = activity.moving_time ?? activity.elapsed_time;
  const avgPace = distanceKm > 0
    ? Math.round(duration / distanceKm)
    : activity.average_speed && activity.average_speed > 0
      ? Math.round(1000 / activity.average_speed)
      : 0;

  return {
    id: crypto.randomUUID(),
    userId,
    source: 'strava',
    externalId: String(activity.id),
    startTime: activity.start_date,
    distance: Number(distanceKm.toFixed(3)),
    duration,
    elevationGain: activity.total_elevation_gain,
    avgPace,
    avgHR: activity.average_heartrate,
    maxHR: activity.max_heartrate,
    splits: (activity.splits_metric ?? []).map(mapSplit).filter((split) => split.km > 0 && split.pace > 0),
  };
}

function applyMatchedActivityToPlan(
  plan: TrainingPlan,
  sessionId: string,
  activityId: string,
): TrainingPlan {
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) => {
        if (!session || session.id !== sessionId) return session;
        return {
          ...session,
          actualActivityId: activityId,
        };
      }),
    })),
  };
}

function describeMatchedSession(session: PlannedSession): StravaSyncMatchSummary {
  return {
    sessionId: session.id,
    sessionType: session.type,
    sessionDate: session.date,
  };
}

export async function syncStravaActivities(
  userId: string,
  deps: SyncStravaActivitiesDeps,
): Promise<StravaSyncResult> {
  const now = deps.now ?? (() => new Date());
  const nowDate = now();
  const token = await deps.integrationTokenRepo.get(userId, 'strava');
  const plan = await deps.planRepo.getActive(userId);
  const accessToken = await deps.tokenService.getValidToken(userId);

  const after = token?.lastSyncedAt ?? getInitialSyncAfter(plan, nowDate);
  const fetchedActivities = await deps.stravaClient.getActivities(accessToken, after);

  let currentPlan = plan;
  const newlyMatchedSessionIds = new Set<string>();
  const result: StravaSyncResult = {
    new: 0,
    skipped: 0,
    matched: 0,
    matchedSessions: [],
  };

  for (const externalActivity of fetchedActivities) {
    if (!isRunActivity(externalActivity)) {
      continue;
    }

    const externalId = String(externalActivity.id);
    const existing = await deps.activityRepo.getByExternalId(userId, 'strava', externalId);
    if (existing) {
      result.skipped += 1;
      continue;
    }

    const activity = mapActivity(userId, externalActivity);
    const matchedSession = currentPlan
      ? matchActivity(activity, currentPlan.weeks, newlyMatchedSessionIds)
      : null;

    if (matchedSession) {
      activity.matchedSessionId = matchedSession.id;
      newlyMatchedSessionIds.add(matchedSession.id);
    }

    const saved = await deps.activityRepo.save(activity);
    result.new += 1;

    if (matchedSession && currentPlan) {
      currentPlan = applyMatchedActivityToPlan(currentPlan, matchedSession.id, saved.id);
      await deps.planRepo.updateWeeks(currentPlan.id, currentPlan.weeks);
      result.matched += 1;
      result.matchedSessions.push(describeMatchedSession(matchedSession));
    }
  }

  await deps.integrationTokenRepo.updateLastSyncedAt(userId, 'strava', nowDate.toISOString());

  return result;
}
