# Steady — Product

## The core belief

A training plan is a living document, not a prescription. The best runners in the world adapt constantly — not because they're undisciplined, but because the body doesn't follow a spreadsheet. The gap in the market is not AI plan generation. Every app already does that. The gap is AI that serves a plan the user already trusts, watching it unfold in reality, and helping adapt it when reality diverges.

Steady is not a plan generator. It is a plan executor and adapter.

---

## The problem it solves

### What self-coached runners actually do today

1. They create a training plan — from Pfitzinger, Jack Daniels, 80/20, or increasingly from an LLM conversation
2. They run with Garmin, Apple Watch, or Strava
3. They track planned vs actual in a Google Sheets document, or they don't track it at all
4. When something goes wrong (injury, fatigue, missed session) they either re-open ChatGPT to adapt the plan, or they just wing it
5. They have no persistent record of why adaptations were made

This workflow is broken in four places:
- **No single home for the plan.** It lives in a doc somewhere
- **No planned vs actual view.** They can see what they ran; they can't easily compare it to what they were supposed to run
- **No adaptive intelligence.** The plan is static the moment it's created
- **No coach memory.** Every ChatGPT session starts from scratch

Steady fixes all four.

### The specific pain points, validated by research

**TrainingPeaks is expensive and dated.** Price increased to $135/year in 2025. Athletes describe it as "stuck in 2010-era development." Power users are migrating to Intervals.icu (free) but Intervals.icu has zero AI and a steep learning curve.

**Runna doesn't accept custom plans.** It generates its own plans only. Athletes who want to follow Pfitzinger 18/70, a coach's programme, or an LLM-generated block have no use for Runna. Runna also has an injury problem — it defaults to ~60/40 intensity split, violating the 80/20 principle. Physical therapists report multiple Runna-related injury cases per week (The5KRunner, Feb 2026).

**Strava's AI is a joke.** "Athlete Intelligence" launched late 2024 and generated universal mockery for being generic and contextless. After a cyclist was hit by a car, Strava's AI congratulated them on their consistency.

**Garmin can't import custom plans.** A Garmin forum thread requesting custom plan import has been open for 5+ years with hundreds of frustrated replies.

**LLM-generated plans are real but unsupported.** Runners are creating plans with ChatGPT and Claude, but then have nowhere to track them. The plan exists in a chat window. Academic research (Düking et al., 2024) confirms LLM plans improve significantly with more detailed prompts — but the runner still has no tool to execute the result.

---

## Target users

### Primary: The self-coached serious runner

- Runs 4–6 days per week, 50–80km per week
- Training for a specific goal race (marathon, half marathon, 10K)
- Has created their plan from literature (Pfitzinger, Hansons, Jack Daniels), YouTube, Reddit, or an LLM
- Uses Garmin, Apple Watch, or Strava to track runs
- Understands periodisation, knows what a tempo run is, doesn't need terms explained
- Has probably used TrainingPeaks or Runna and found them limiting
- Age typically 28–45, London/NYC/Berlin/Sydney demographic

### Secondary: The AI-assisted planner

- Used ChatGPT or Claude to create a training block
- Ran the plan for a few weeks in their head or on paper
- Frustrated that the LLM doesn't remember what happened last week
- Looking for a way to close the loop between the plan and the execution

### Out of scope for MVP: Coaches and their athletes

This is a V2 feature. The coach-athlete platform requires a different auth model, different UX patterns, and B2B thinking. Do not build it in V1.

---

## The core loop

Three actions, repeated weekly:

```
Build / import plan → Track against reality → Talk to coach and adapt
```

Every screen must serve one of these three actions. If a feature doesn't, cut it.

---

## What makes Steady different from every other app

| Capability | Strava | Runna | TrainingPeaks | Intervals.icu | **Steady** |
|---|---|---|---|---|---|
| Import your own plan | ✗ | ✗ | ✓ | ✓ | ✓ |
| Planned vs actual view | ✗ | Partial | ✓ | ✓ | ✓ |
| AI conversation about sessions | ✗ | Limited | ✗ | ✗ | **✓** |
| AI adapts plan mid-cycle | ✗ | ✗ | ✗ | ✗ | **✓** |
| Coach initiates (proactive) | ✗ | ✗ | ✗ | ✗ | **✓** |
| Pace trace: planned vs actual | ✗ | ✗ | ✗ | Limited | **✓** |
| Phase-aware plan structure | ✗ | Partial | ✓ | ✓ | **✓** |

The two columns in bold are Steady's exclusive territory. No other app does them.

---

## MVP scope

### In

- Plan creation (3-step builder: goal → template week → full plan)
- Strava sync (OAuth + webhook for new activities)
- Apple Health sync (HKWorkout reads)
- Week view (current week, planned vs actual, load bar, AI nudge)
- Block view (full plan timeline with phase strip)
- Session detail (planned vs actual with pace trace)
- AI coach (Steady) — post-run debrief, weekly preview, plan adaptation
- Settings (integrations, plan management, subscription)

### Explicitly out of MVP

- Coach / athlete platform (V2)
- In-app GPS recording (competes with Garmin/Apple Watch; not our bet)
- Social features (Strava owns this)
- Nutrition tracking (scope creep)
- Workout push to watch (Garmin API complexity)
- Marketplace for plans (monetise later)
- Android (ship iOS first, validate, then Android in 3–6 months)

---

## Monetisation

- Free tier: plan creation and tracking, no AI coach
- Steady Pro: £9.99/month or £89.99/year — unlocks AI coach, post-run debriefs, plan adaptation
- Target: 5,000 paying users = £600K ARR. Viable indie business.
- Conversion model: hard paywall after 2-week free trial (Runna model)
