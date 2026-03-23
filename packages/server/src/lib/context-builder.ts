import type { User, TrainingPlan, Activity, PlanWeek, PlannedSession, ConversationType } from '@steady/types';
import { secondsToPace } from './pace-utils';
import { getCoachingKnowledge } from './coaching-knowledge';

/**
 * Build the system prompt for the AI coach.
 *
 * Hides: Compact plan formatting, token budget management (4-6k target),
 * activity log formatting, phase/week position calculation,
 * conversation-type-specific framing.
 */
export function buildSystemPrompt(
  user: User,
  plan: TrainingPlan,
  recentActivities: Activity[],
  conversationType: ConversationType,
  justCompleted?: { session: PlannedSession; activity: Activity },
): string {
  const sections: string[] = [];

  // Base persona
  sections.push(PERSONA);

  // Coaching knowledge base
  sections.push(getCoachingKnowledge());

  // Runner context
  sections.push(buildRunnerContext(user, plan));

  // Training plan (current + next 2 weeks)
  sections.push(buildPlanSection(plan, recentActivities));

  // Recent activity log (last 4 weeks)
  sections.push(buildActivityLog(recentActivities));

  // Conversation-specific framing
  sections.push(buildConversationFrame(conversationType, justCompleted));

  return sections.filter(Boolean).join('\n\n');
}

const PERSONA = `You are Steady, an AI running coach in the Steady app. You are direct, specific, knowledgeable, and concise. You never give generic advice. You always reference specific data from the runner's plan and runs.

Guidelines:
- Keep responses under 150 words unless the runner asks for detail
- Reference specific numbers (paces, distances, HR) from their data
- When suggesting plan changes, be specific about what to change and why
- Never say "listen to your body" without a concrete follow-up action`;

function buildRunnerContext(user: User, plan: TrainingPlan): string {
  const currentWeek = findCurrentWeek(plan);
  const weeksRemaining = plan.weeks.length - (currentWeek?.weekNumber ?? 1) + 1;

  return `RUNNER CONTEXT:
- Goal: ${plan.raceName} on ${plan.raceDate}, target ${plan.targetTime}
- Current phase: ${currentWeek?.phase ?? 'BUILD'} (Week ${currentWeek?.weekNumber ?? 1} of ${plan.weeks.length})
- Weeks to race: ${weeksRemaining}
- Units: ${user.units}`;
}

function buildPlanSection(plan: TrainingPlan, activities: Activity[]): string {
  const currentIdx = findCurrentWeekIndex(plan);
  const start = Math.max(0, currentIdx);
  const end = Math.min(plan.weeks.length, currentIdx + 3);
  const weeks = plan.weeks.slice(start, end);

  const activityMap = new Map<string, Activity>();
  for (const a of activities) {
    if (a.matchedSessionId) activityMap.set(a.matchedSessionId, a);
  }

  const lines = ['TRAINING PLAN (current + next 2 weeks):'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (const week of weeks) {
    const label = week.weekNumber === (findCurrentWeek(plan)?.weekNumber ?? 0) ? 'current' : 'upcoming';
    lines.push(`\nWeek ${week.weekNumber} (${label}, ${week.phase}):`);

    for (let d = 0; d < week.sessions.length; d++) {
      const s = week.sessions[d];
      if (!s || s.type === 'REST') {
        lines.push(`  ${dayNames[d] ?? `D${d}`}: REST`);
        continue;
      }

      let desc = formatSession(s);
      const matched = activityMap.get(s.id);
      if (matched) {
        desc += ` ✓ (actual: ${matched.distance.toFixed(1)}km @ ${secondsToPace(matched.avgPace)}`;
        if (matched.avgHR) desc += `, HR ${matched.avgHR}`;
        desc += ')';
      }
      lines.push(`  ${dayNames[d] ?? `D${d}`}: ${desc}`);
    }
  }

  return lines.join('\n');
}

function buildActivityLog(activities: Activity[]): string {
  if (activities.length === 0) return 'RECENT ACTIVITY: None';

  const sorted = [...activities].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  // Limit to ~15 most recent to keep within token budget
  const recent = sorted.slice(0, 15);

  const lines = ['RECENT ACTIVITY (last 4 weeks):'];
  for (const a of recent) {
    const date = a.startTime.slice(0, 10);
    let line = `  ${date}: ${a.distance.toFixed(1)}km in ${formatDuration(a.duration)} @ ${secondsToPace(a.avgPace)}`;
    if (a.avgHR) line += `, HR ${a.avgHR}`;
    lines.push(line);
  }

  return lines.join('\n');
}

function buildConversationFrame(
  type: ConversationType,
  justCompleted?: { session: PlannedSession; activity: Activity },
): string {
  switch (type) {
    case 'post_run_debrief': {
      if (!justCompleted) return 'CONVERSATION TYPE: Post-run debrief (no session data available)';
      const { session, activity } = justCompleted;
      const planned = formatSession(session);
      const actual = `${activity.distance.toFixed(1)}km in ${formatDuration(activity.duration)} @ ${secondsToPace(activity.avgPace)}`;
      const distDev = ((activity.distance - (expectedDistance(session))) / expectedDistance(session) * 100).toFixed(0);

      let frame = `JUST COMPLETED:\n${session.type}: ${actual}\nPlanned: ${planned}\nDistance deviation: ${distDev}%`;
      if (activity.avgHR) frame += `\nAvg HR: ${activity.avgHR} bpm`;
      frame += '\n\nProvide a brief debrief. Comment on execution vs plan. Highlight anything notable.';
      return frame;
    }
    case 'weekly_preview':
      return 'CONVERSATION TYPE: Weekly preview\nProvide a concise preview of the upcoming training week. Highlight key sessions, volume trends, and any adjustments to watch for.';
    case 'missed_session':
      return 'CONVERSATION TYPE: Missed session check-in\nA planned session was not completed. Ask about it briefly — was it intentional rest, injury, or scheduling? Suggest an adjustment if needed.';
    case 'free_form':
      return 'CONVERSATION TYPE: Free-form\nThe runner is asking a question or chatting. Be helpful and specific.';
  }
}

// --- Helpers ---

function formatSession(s: PlannedSession): string {
  if (s.type === 'REST') return 'REST';
  if (s.type === 'INTERVAL') {
    let desc = `INTERVAL ${s.reps ?? 6}×${s.repDist ?? 800}m`;
    if (s.pace) desc += ` @ ${s.pace}`;
    return desc;
  }
  let desc = `${s.type} ${s.distance ?? '?'}km`;
  if (s.pace) desc += ` @ ${s.pace}`;
  return desc;
}

function expectedDistance(s: PlannedSession): number {
  if (s.type === 'INTERVAL' && s.reps && s.repDist) {
    return s.reps * s.repDist / 1000 + (s.warmup ?? 0) + (s.cooldown ?? 0);
  }
  return (s.distance ?? 8) + (s.warmup ?? 0) + (s.cooldown ?? 0);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function findCurrentWeekIndex(plan: TrainingPlan): number {
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < plan.weeks.length; i++) {
    const sessions = plan.weeks[i].sessions.filter(Boolean) as PlannedSession[];
    if (sessions.length === 0) continue;
    const dates = sessions.map((s) => s.date);
    if (dates.some((d) => d >= today)) return i;
  }
  return plan.weeks.length - 1;
}

function findCurrentWeek(plan: TrainingPlan): PlanWeek | undefined {
  return plan.weeks[findCurrentWeekIndex(plan)];
}
