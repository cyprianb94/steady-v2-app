import type { User, TrainingPlan, Activity, PlanWeek, PlannedSession, ConversationType, SubjectiveInput } from '@steady/types';
import { expectedDistance } from '@steady/types';
import { secondsToPace } from './pace-utils';
import { getCoachingKnowledge } from './coaching-knowledge';

/**
 * Token budget configuration.
 *
 * We approximate 1 token ≈ 4 characters. The target is 4-6k tokens
 * for the full system prompt. Hard cap at 24,000 chars (~6k tokens).
 */
const TOKEN_BUDGET_CHARS = 24_000;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  // Fixed sections (persona, knowledge, context, conversation frame)
  const persona = PERSONA;
  const knowledge = getCoachingKnowledge();
  const runnerCtx = buildRunnerContext(user, plan);
  const convFrame = buildConversationFrame(conversationType, justCompleted);

  // Calculate fixed budget used
  const fixedChars = persona.length + knowledge.length + runnerCtx.length + convFrame.length + 8; // 8 for \n\n joiners
  const remainingBudget = TOKEN_BUDGET_CHARS - fixedChars;

  // Dynamic sections share remaining budget: 60% plan, 40% activity log
  const planBudget = Math.floor(remainingBudget * 0.6);
  const activityBudget = remainingBudget - planBudget;

  const planSection = buildPlanSection(plan, recentActivities, planBudget);
  const activitySection = buildActivityLog(recentActivities, activityBudget);

  const sections = [persona, knowledge, runnerCtx, planSection, activitySection, convFrame];
  return sections.filter(Boolean).join('\n\n');
}

/** Approximate token count (chars / 4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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
  const rearrangements = buildSessionRearrangementContext(plan);

  return `RUNNER CONTEXT:
- Goal: ${plan.raceName} on ${plan.raceDate}, target ${plan.targetTime}
- Current phase: ${currentWeek?.phase ?? 'BUILD'} (Week ${currentWeek?.weekNumber ?? 1} of ${plan.weeks.length})
- Weeks to race: ${weeksRemaining}
- Units: ${user.units}${rearrangements ? `\n${rearrangements}` : ''}`;
}

function buildPlanSection(plan: TrainingPlan, activities: Activity[], charBudget: number): string {
  const currentIdx = findCurrentWeekIndex(plan);

  const activityMap = new Map<string, Activity>();
  for (const a of activities) {
    if (a.matchedSessionId) activityMap.set(a.matchedSessionId, a);
  }

  const lines = ['TRAINING PLAN (current + next 2 weeks):'];
  let charCount = lines[0].length;

  // Show current + up to 2 more weeks, but truncate if over budget
  const maxWeeks = Math.min(3, plan.weeks.length - currentIdx);
  for (let wi = 0; wi < maxWeeks; wi++) {
    const week = plan.weeks[currentIdx + wi];
    if (!week) break;

    const label = wi === 0 ? 'current' : 'upcoming';
    const weekHeader = `\nWeek ${week.weekNumber} (${label}, ${week.phase}):`;

    if (charCount + weekHeader.length > charBudget) break;
    lines.push(weekHeader);
    charCount += weekHeader.length;

    for (let d = 0; d < week.sessions.length; d++) {
      const s = week.sessions[d];
      let line: string;
      if (!s || s.type === 'REST') {
        line = `  ${DAY_NAMES[d] ?? `D${d}`}: REST`;
      } else {
        let desc = formatSession(s);
        const matched = activityMap.get(s.id);
        if (matched) {
          desc += ` ✓ (actual: ${matched.distance.toFixed(1)}km @ ${secondsToPace(matched.avgPace)}`;
          if (matched.avgHR) desc += `, HR ${matched.avgHR}`;
          desc += ')';
        }
        if (s.subjectiveInput) {
          desc += ` (${formatSubjectiveInput(s.subjectiveInput)})`;
        }
        line = `  ${DAY_NAMES[d] ?? `D${d}`}: ${desc}`;
      }

      if (charCount + line.length > charBudget) break;
      lines.push(line);
      charCount += line.length;
    }
  }

  return lines.join('\n');
}

function buildSessionRearrangementContext(plan: TrainingPlan): string {
  const lines: string[] = [];

  for (const week of plan.weeks) {
    if (!week.swapLog?.length) continue;

    const moves = week.swapLog.flatMap((entry) => {
      const fromDay = DAY_NAMES[entry.from] ?? `D${entry.from}`;
      const toDay = DAY_NAMES[entry.to] ?? `D${entry.to}`;
      const movedToDestination = formatSwapMove(week.sessions[entry.to], fromDay, toDay);
      const movedToOrigin = formatSwapMove(week.sessions[entry.from], toDay, fromDay);
      return [movedToDestination, movedToOrigin].filter(Boolean) as string[];
    });

    if (moves.length > 0) {
      lines.push(`- Week ${week.weekNumber}: ${moves.join(', ')}`);
    }
  }

  if (lines.length === 0) return '';
  return ['SESSION REARRANGEMENTS:', ...lines].join('\n');
}

function formatSwapMove(session: PlannedSession | null, fromDay: string, toDay: string): string | null {
  if (!session || session.type === 'REST') return null;
  return `${formatSwapSessionType(session)} moved ${fromDay}→${toDay}`;
}

function formatSwapSessionType(session: PlannedSession): string {
  switch (session.type) {
    case 'INTERVAL':
      return 'Intervals';
    case 'LONG':
      return 'Long';
    case 'TEMPO':
      return 'Tempo';
    case 'EASY':
      return 'Easy';
    case 'REST':
      return 'Rest';
  }
}

function buildActivityLog(activities: Activity[], charBudget: number): string {
  if (activities.length === 0) return 'RECENT ACTIVITY: None';

  const sorted = [...activities].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  const lines = ['RECENT ACTIVITY (last 4 weeks):'];
  let charCount = lines[0].length;

  // Add activities until we hit budget or 15 entries
  for (const a of sorted.slice(0, 15)) {
    const date = a.startTime.slice(0, 10);
    let line = `  ${date}: ${a.distance.toFixed(1)}km in ${formatDuration(a.duration)} @ ${secondsToPace(a.avgPace)}`;
    if (a.avgHR) line += `, HR ${a.avgHR}`;
    if (a.subjectiveInput) line += ` (${formatSubjectiveInput(a.subjectiveInput)})`;

    if (charCount + line.length > charBudget) break;
    lines.push(line);
    charCount += line.length;
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
      if (session.subjectiveInput) frame += `\nSession felt: ${formatSubjectiveInput(session.subjectiveInput)}`;
      if (activity.subjectiveInput) frame += `\nActivity felt: ${formatSubjectiveInput(activity.subjectiveInput)}`;
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatSubjectiveInput(input: SubjectiveInput): string {
  return `felt: legs ${input.legs}, breathing ${input.breathing}, overall ${input.overall}`;
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
