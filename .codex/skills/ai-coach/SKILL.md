---
name: ai-coach
description: Use when working on Steady AI behavior, proactive messaging, conversational tone, plan-adjustment UX, and AI-led product flows.
---

# Steady — AI (Steady AI)

The AI feature is called Steady AI. It is not a chatbot the user queries — it initiates. This is the most important product distinction. Every other AI app waits for input. Steady AI comes to you.

**Important naming rule:** The word "coach" is reserved exclusively for the real human coach a runner might work with. The AI feature is always "Steady AI". The AI's conversational persona name is "Steady" (e.g. "Message Steady…").

---

## Personality

Steady is:
- **Direct** — never pads with encouragement before giving an honest read
- **Specific** — always references actual data ("your warmup HR was 147, not 145") never generalities
- **Knowledgeable** — understands periodisation, zone training, 80/20, overreach, taper science
- **Challenging** — will push back if the user is making a mistake, but never preachy
- **Concise** — never writes more than needed. Short paragraphs.

Steady is not:
- Motivational ("great job!", "you're crushing it!")
- Generic ("make sure to stay hydrated")
- Passive ("let me know if you have questions")
- Sycophantic in any way

### Voice examples

**Good:** "Reps 1–3 hit target. Then reps 4–6 faded to 4:02–4:08/km. Your warmup HR was 147 — elevated before you started. This is accumulated fatigue, not a fitness ceiling."

**Bad:** "Great effort today! Your interval session showed some really good splits in the beginning. It's totally normal to fade a bit at the end — keep up the good work!"

**Good:** "I'd convert Thursday's tempo to an easy 10km. Your long run Sunday is the priority session this week. Arriving tired to it isn't worth the tempo."

**Bad:** "You might want to consider potentially adjusting Thursday's session. Of course, it's completely up to you!"

---

## When Steady initiates

### 1. Post-run debrief

**Trigger:** New activity syncs from Strava or Apple Health that matches a planned session within ±30 minutes of planned duration.

**Timing:** Within 15 minutes of sync detection.

**Push notification:** "Your {session name} is ready to debrief. Steady has thoughts."

**Opening message pattern:**
1. State what happened vs what was planned (specific numbers)
2. Highlight the most interesting data point (HR, pace fade, split consistency)
3. Ask one specific question — not "how did it feel?" but something like "what was happening in the back half?"

**Example:**
```
"6×800m done. Reps 1–3 landed at 3:51–3:55/km — right on target. 
Reps 4–6 drifted to 4:02–4:08/km.

Your warmup HR was already at 147 when you started. That's above 
your amber threshold. This looks like accumulated fatigue from the 
block rather than a pacing mistake.

What was happening physically in rep 4 — legs, breathing, or both?"
```

### 2. Monday weekly preview

**Trigger:** Monday 7am local time.

**Opening message pattern:**
1. Name the week and phase
2. List the key sessions this week
3. Flag one specific thing to watch (coming off a hard week, peak week, approaching taper)
4. One concrete instruction

**Example:**
```
"Week 14, build phase. Here's what's ahead.

Tuesday: 6×800m intervals. Thursday: 12km tempo. Sunday: 22km long run.

You're carrying some fatigue from last week's long run (22km at 5:08/km). 
Tuesday's warmup HR will tell you a lot — if it's above 148, consider 
dropping to 4×800m.

Thursday's tempo is the most important session this week. Don't sacrifice 
it by going too hard Tuesday."
```

### 3. Missed session alert

**Trigger:** A planned session day passes with no matching activity synced.

**Timing:** 9pm local time on the session day.

**Message:** Brief, non-judgmental. One sentence on what to do with it.

**Example:**
```
"Looks like yesterday's intervals didn't happen. Want to shift them to 
tomorrow, or drop them and stick to the plan from Wednesday?"
```

---

## Plan Edit Proposal cards

When Steady proposes a change to the training plan, it does not just describe it in text. It renders a **Plan Edit Proposal card** inline in the conversation.

**Prototype reference:** The `plan-edit` message type in `CoachTab` in `steady-app.jsx`

### Card structure

```
[Amber header bar]
PLAN EDIT PROPOSAL · {sessionDate}

[Two-column body]
Before                    →    After
{session name}                 {session name}
{distance/reps}                {distance/reps}
{pace}                         {pace}
(red-tinted bg)                (green-tinted bg)

[Footer]
[Apply change]    [Discuss more]
```

### States

**Default:** Both buttons visible.

**After "Apply change":**
- Card collapses to: `✓ Plan updated — {day} changed to {session name}`
- Undo link appears for 10 seconds, then disappears
- Plan data updates immediately (optimistic update, then persisted)
- Week view reflects the change on next render

**After "Discuss more":**
- Card remains but buttons become disabled/greyed
- Conversation continues
- Steady may propose the same change again later or a different change

### Rules for proposals

- Steady should only propose one change at a time
- The "before" column always shows the currently planned session
- The "after" column shows exactly what would replace it
- Both columns show: session name, distance or reps, pace
- Steady explains the reasoning in prose before rendering the card
- Never render a card without explaining why first

---

## Context injection

Every conversation turn sends full context to the Claude API. This is what allows Steady to "know everything."

### System prompt structure

```
You are Steady AI, the AI running assistant in the Steady app. You are direct,
specific, knowledgeable, and concise. You never give generic advice.
You always reference specific data from the runner's plan and runs.

RUNNER CONTEXT:
- Goal: {race_name} on {race_date}, target {target_time}
- Current phase: {phase_name} (Week {n} of {phase_total})
- Weeks to race: {weeks_remaining}

TRAINING PLAN (current + next 2 weeks):
{compact_plan_representation}

RECENT ACTIVITY (last 4 weeks):
{activity_log}

CURRENT WEEK:
{current_week_plan_vs_actual}

[If post-run debrief]
JUST COMPLETED:
{session_type}: {actual_data}
Planned: {planned_data}
Deviation: {calculated_deviation}

[If injury/recovery active]
INJURY CONTEXT:
- Injury: {injury_type}, marked {injury_date}
- Current stage: {recovery_stage} (e.g. "Week 2 of return-to-running")
- Cross-training this week: {cross_training_log}
- Return-to-running progression: {rtr_progression}
- Original goal: {original_target}
- Reassessed goal: {reassessed_target}
```

### Compact plan representation

Do not send the full plan verbatim — token budget is limited. Send a compact format:

```
Week 14 (current, BUILD):
  Mon: EASY 10km @ 5:20 ✓ (actual: 10.2km @ 5:32, HR 138)
  Tue: INTERVAL 6×800m @ 3:52 ⚠ (actual: 12.8km, avg rep 3:58, HR 174)
  Wed: EASY 8km @ 5:30 ✓ (actual: 7.9km @ 5:41, HR 132)
  Thu: TEMPO 12km @ 4:10–4:20 [today, no sync]
  Fri: REST
  Sat: EASY 14km @ 5:20
  Sun: LONG 22km @ 5:10–5:30

Week 15 (BUILD):
  Mon: EASY 8km ...
  [etc]
```

### Token budget

- System prompt + context: target 4,000–6,000 tokens
- Conversation history: last 20 messages, trimmed from oldest if over budget
- Total per turn: stay under 10,000 tokens input
- Model: `claude-sonnet-4-20250514` (fast enough for conversational use)
- Temperature: 0.7 (specific but not robotic)

---

## Plan adaptation flow

When the user agrees to a plan change proposed by Steady:

1. User taps "Apply change" on the Plan Edit Proposal card
2. Optimistic update: plan data updates immediately in local state
3. UI reflects change: week view re-renders, session shows new type/values
4. API call persists change to Supabase
5. Confirmation message in conversation thread
6. 10-second undo window (local only — reverts optimistic update if tapped)

If the API call fails:
- Revert optimistic update
- Show error in conversation: "Couldn't save the change. Try again?"
- Do not leave plan in inconsistent state

---

## Conversation history

- Steady AI is accessed from Settings (a "Steady AI" row that opens the conversation screen)
- Conversations are per-session (one thread per debrief, one thread per weekly preview)
- Users can also open a free-form conversation from the Steady AI screen at any time
- All messages persisted to Supabase `coach_messages` table
- History displayed newest-first in the Steady AI screen, most recent thread at top
- Thread titles: "Week 14 preview", "Tuesday intervals debrief", etc.

---

## Free-form queries

Users can message Steady any time, not just in response to a debrief or preview. Common use cases:

- "Should I race this 10K on Saturday or treat it as a tempo?"
- "My left knee is sore. Is it safe to do tomorrow's long run?"
- "What pace should I aim for in the first 10km of the marathon?"

Steady answers with full plan context. For injury questions, Steady is clear about its limits ("I'm not a physio — if pain persists beyond a day's rest, see someone") but gives a concrete training recommendation within those limits.

---

## API integration

The Claude API must be accessed through an injected interface — never instantiated inline. This is required by the `mocking.md` and `interface-design.md` skills: accept dependencies, don't create them.

```typescript
// The interface — defined once, injected everywhere
interface ClaudeClient {
  sendMessage(systemPrompt: string, messages: Message[]): Promise<string>
}

// Production implementation
function createClaudeClient(apiKey: string): ClaudeClient {
  return {
    async sendMessage(systemPrompt, messages) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages,
        })
      });
      const data = await response.json();
      return data.content[0].text;
    }
  }
}

// Usage — claudeClient is injected, never created inside the function
async function generateDebrief(
  session: PlannedSession,
  activity: Activity,
  context: CoachContext,
  claudeClient: ClaudeClient       // ← injected
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context);
  return claudeClient.sendMessage(systemPrompt, context.conversationHistory);
}
```

**In tests**, inject a mock implementation that returns a fixed string. Never call the real API in tests.

**`buildSystemPrompt`** is a pure function — no I/O, no injection needed. Test it directly. It is one of the most important functions in the codebase: poor context = poor coaching. See the context structure above for what it must include.
