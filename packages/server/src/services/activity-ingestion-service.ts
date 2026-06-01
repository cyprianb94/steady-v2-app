import type {
  Activity,
  ActivityImportResult,
  ActivityRunSubtype,
  NormalizedProviderActivity,
  PlannedSession,
  ProviderActivitySource,
  PrimaryRunSource,
  TrainingPlan,
} from '@steady/types';
import { isoDateInTimezone } from '../lib/iso-date';
import { matchActivity } from '../lib/activity-matcher';
import type { ActivityRepo } from '../repos/activity-repo';
import type { ActivityProvenanceRepo } from '../repos/activity-provenance-repo';
import type { ActivitySyncLogRepo } from '../repos/activity-sync-log-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import { repairOrphanedActivityLinks } from './orphaned-activity-link-repair';

export interface ActivityIngestionService {
  ingest(userId: string, records: NormalizedProviderActivity[]): Promise<ActivityImportResult>;
}

interface ActivityIngestionServiceDeps {
  profileRepo: ProfileRepo;
  activityRepo: ActivityRepo;
  planRepo: PlanRepo;
  provenanceRepo: ActivityProvenanceRepo;
  syncLogRepo: ActivitySyncLogRepo;
  now?: () => Date;
}

interface DuplicateCandidate {
  activity: Activity;
  confidence: 'high' | 'low';
}

const DIRECT_SOURCE_PRECEDENCE: Record<ProviderActivitySource, PrimaryRunSource> = {
  apple_health: 'apple_watch',
  garmin: 'garmin',
  strava: 'strava',
};

function activitySourceForPrimary(primaryRunSource: PrimaryRunSource | undefined): ProviderActivitySource | null {
  if (primaryRunSource === 'apple_watch') return 'apple_health';
  if (primaryRunSource === 'garmin') return 'garmin';
  if (primaryRunSource === 'strava') return 'strava';
  return null;
}

function describeMatchedSession(session: PlannedSession): ActivityImportResult['matchedSessions'][number] {
  return {
    sessionId: session.id,
    sessionType: session.type,
    sessionDate: session.date,
  };
}

function applyMatchedActivityToPlan(plan: TrainingPlan, sessionId: string, activityId: string): TrainingPlan {
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

function calculateAvgPace(record: NormalizedProviderActivity): number {
  if (record.avgPaceSecondsPerKm && Number.isFinite(record.avgPaceSecondsPerKm)) {
    return Math.round(record.avgPaceSecondsPerKm);
  }

  return record.distanceKm > 0
    ? Math.round((record.movingDurationSeconds ?? record.durationSeconds) / record.distanceKm)
    : 0;
}

function mapRecordToActivity(
  userId: string,
  record: NormalizedProviderActivity,
  existing?: Activity,
): Activity {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    userId,
    source: record.source,
    externalId: record.externalId,
    name: record.name,
    sourceName: record.sourceName,
    sourceDevice: record.sourceDevice,
    runSubtype: record.runSubtype,
    startTime: record.startTime,
    distance: Number(record.distanceKm.toFixed(3)),
    duration: Math.round(record.movingDurationSeconds ?? record.durationSeconds),
    elevationGain: record.elevationGainM,
    avgPace: calculateAvgPace(record),
    avgHR: record.avgHR,
    maxHR: record.maxHR,
    avgCadence: record.avgCadence,
    splits: record.splits,
    subjectiveInput: existing?.subjectiveInput,
    matchedSessionId: existing?.matchedSessionId,
    shoeId: existing?.shoeId,
    notes: existing?.notes,
    fuelEvents: existing?.fuelEvents,
  };
}

function isSameKnownSubtype(left: ActivityRunSubtype | undefined, right: ActivityRunSubtype | undefined): boolean {
  if (!left || !right || left === 'unknown' || right === 'unknown') {
    return true;
  }

  return left === right;
}

function findDuplicateCandidate(record: NormalizedProviderActivity, activities: Activity[]): DuplicateCandidate | null {
  const startMs = new Date(record.startTime).getTime();
  if (Number.isNaN(startMs)) return null;

  let best: DuplicateCandidate | null = null;

  for (const activity of activities) {
    if (activity.source === record.source && activity.externalId === record.externalId) {
      return { activity, confidence: 'high' };
    }

    const activityStartMs = new Date(activity.startTime).getTime();
    if (Number.isNaN(activityStartMs)) continue;

    const timeDiffSeconds = Math.abs(activityStartMs - startMs) / 1000;
    const distanceDiffKm = Math.abs(activity.distance - record.distanceKm);
    const durationDiffSeconds = Math.abs(activity.duration - record.durationSeconds);
    const distanceToleranceKm = Math.max(0.2, Math.max(activity.distance, record.distanceKm) * 0.05);
    const durationToleranceSeconds = Math.max(60, Math.max(activity.duration, record.durationSeconds) * 0.05);

    if (
      timeDiffSeconds <= 180
      && distanceDiffKm <= distanceToleranceKm
      && durationDiffSeconds <= durationToleranceSeconds
      && isSameKnownSubtype(activity.runSubtype, record.runSubtype)
    ) {
      return { activity, confidence: 'high' };
    }

    if (
      timeDiffSeconds <= 10 * 60
      && distanceDiffKm <= Math.max(0.5, distanceToleranceKm * 2)
      && durationDiffSeconds <= Math.max(180, durationToleranceSeconds * 2)
    ) {
      best ??= { activity, confidence: 'low' };
    }
  }

  return best;
}

function shouldSupersedeDuplicate(
  record: NormalizedProviderActivity,
  duplicate: Activity,
  primaryRunSource: PrimaryRunSource | undefined,
): boolean {
  if (duplicate.source === record.source) {
    return true;
  }

  const primarySource = activitySourceForPrimary(primaryRunSource);
  if (primarySource && primarySource !== record.source) {
    return false;
  }

  if (duplicate.source === 'strava' && (record.source === 'apple_health' || record.source === 'garmin')) {
    return true;
  }

  return DIRECT_SOURCE_PRECEDENCE[record.source] === primaryRunSource;
}

function syncSource(records: NormalizedProviderActivity[]): ProviderActivitySource {
  return records[0]?.source ?? 'apple_health';
}

export function createActivityIngestionService(deps: ActivityIngestionServiceDeps): ActivityIngestionService {
  const now = deps.now ?? (() => new Date());

  return {
    async ingest(userId: string, records: NormalizedProviderActivity[]): Promise<ActivityImportResult> {
      const startedAt = now();
      const source = syncSource(records);
      const profile = await deps.profileRepo.getById(userId);
      const plan = await repairOrphanedActivityLinks(userId, deps, {
        plan: await deps.planRepo.getActive(userId),
        strict: true,
      });
      const timezone = profile?.timezone ?? 'UTC';
      let currentPlan = plan;
      let existingActivities = await deps.activityRepo.getByUserId(userId);
      const newlyMatchedSessionIds = new Set<string>();
      const result: ActivityImportResult = {
        fetched: records.length,
        imported: 0,
        skipped: 0,
        upgraded: 0,
        matched: 0,
        errors: 0,
        matchedSessions: [],
        lastSuccessfulSyncAt: null,
      };

      for (const record of records) {
        try {
          if (!record.externalId || record.distanceKm <= 0 || record.durationSeconds <= 0) {
            result.skipped += 1;
            continue;
          }

          const existingByExternalId = await deps.activityRepo.getByExternalId(
            userId,
            record.source,
            record.externalId,
          );
          const duplicate = existingByExternalId
            ? { activity: existingByExternalId, confidence: 'high' as const }
            : findDuplicateCandidate(record, existingActivities);

          if (duplicate?.confidence === 'low') {
            result.skipped += 1;
            continue;
          }

          const isUpgrade = Boolean(
            duplicate
            && duplicate.activity.source !== record.source
            && shouldSupersedeDuplicate(record, duplicate.activity, profile?.primaryRunSource),
          );
          const isSameProviderUpdate = Boolean(duplicate && duplicate.activity.source === record.source);

          if (duplicate && !isUpgrade && !isSameProviderUpdate) {
            result.skipped += 1;
            continue;
          }

          const activity = mapRecordToActivity(userId, record, duplicate?.activity);
          const activityDate = isoDateInTimezone(activity.startTime, record.timezone ?? timezone);
          const matchedSession = !activity.matchedSessionId && currentPlan
            ? matchActivity(activity, currentPlan.weeks, newlyMatchedSessionIds, activityDate)
            : null;

          if (matchedSession) {
            activity.matchedSessionId = matchedSession.id;
            newlyMatchedSessionIds.add(matchedSession.id);
          }

          const savedActivity = await deps.activityRepo.save(activity);
          await deps.provenanceRepo.save({
            id: crypto.randomUUID(),
            userId,
            activityId: savedActivity.id,
            source: record.source,
            externalId: record.externalId,
            sourceName: record.sourceName,
            sourceBundleId: record.sourceBundleId,
            sourceDevice: record.sourceDevice,
            runSubtype: record.runSubtype,
            dataQualityFlags: record.dataQuality,
            importedAt: now().toISOString(),
          });

          if (matchedSession && currentPlan) {
            const nextPlan = applyMatchedActivityToPlan(currentPlan, matchedSession.id, savedActivity.id);
            const updatedPlan = await deps.planRepo.updateWeeks(currentPlan.id, nextPlan.weeks);
            if (updatedPlan) {
              currentPlan = updatedPlan;
              result.matched += 1;
              result.matchedSessions.push(describeMatchedSession(matchedSession));
            }
          }

          if (isUpgrade) {
            result.upgraded += 1;
          } else if (!isSameProviderUpdate) {
            result.imported += 1;
          } else {
            result.skipped += 1;
          }

          existingActivities = [
            savedActivity,
            ...existingActivities.filter((activity) => activity.id !== savedActivity.id),
          ];
        } catch {
          result.errors += 1;
        }
      }

      const finishedAt = now();
      result.lastSuccessfulSyncAt = finishedAt.toISOString();
      await deps.syncLogRepo.save({
        id: crypto.randomUUID(),
        userId,
        source,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        fetchedCount: result.fetched,
        importedCount: result.imported,
        skippedCount: result.skipped,
        upgradedCount: result.upgraded,
        errorCount: result.errors,
        lastSuccessfulSyncAt: result.errors === records.length && records.length > 0 ? null : result.lastSuccessfulSyncAt,
      });

      return result;
    },
  };
}
