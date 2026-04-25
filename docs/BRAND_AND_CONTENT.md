# Steady — Brand and Content

## Product and naming

Steady is an iOS beta for runners who already have a training plan. The current beta focuses on the core loop: build a plan in app, see the current week and block clearly, sync Strava runs back to the plan, compare planned vs actual, and handle injury/recovery without losing context.

Current beta surfaces:
- iOS app — Home, Block, Settings, Steady AI conversation, run detail
- Plan builder — goal, template week, full plan review
- Landing page — waitlist and product story

Not in beta yet:
- CSV/screenshot/photo plan import
- Apple Health or Garmin sync
- Coach invite / coach collaboration
- Proactive Steady AI debriefs, weekly previews, or paid packaging
- Physio export reports

Naming rule: the AI feature is **Steady AI**. The word "coach" is reserved for the real human coach a runner might invite. The AI's persona name is "Steady" in conversational UI, for example "Message Steady...".

---

## Content fundamentals

Steady reads like a coach with a stopwatch, not a SaaS marketing brochure.

Tone:
- Direct. State what happened, then what to do.
- Specific. Reference actual numbers, never generalities.
- Concise. Short paragraphs. Shorter sentences.
- Challenging when warranted. Push back without preaching.
- No motivational fluff. No "great job", "you're crushing it", "stay hydrated", or sycophancy.

Grammar and vocabulary:
- British English: kilometre, colour, realise; pounds for prices.
- Sentence case for buttons and labels. Uppercase only for section labels and chips such as `PLAN`, `INTERVAL`, `TODAY`.
- Second person: "your plan", "you", "you're". Avoid "the user" in product copy.
- Numbers are monospaced. Paces as `4:10/km`, distances as `22km`, times as `5:32/km`, HR as `147`.
- Use: session, block, phase, taper, build, peak, base, tempo, interval, long run, easy, recovery, adapt, sync, planned vs actual, debrief, nudge.
- Avoid: workout, smart, AI-powered, leverage, unlock, game-changer.

Emoji:
- No decorative emoji.
- Run status rows use the custom completed/varied/unfinished icon set, not text glyphs.
- Allowed semantic glyphs outside run status rows: `✓` confirmation/check complete, `●` connected/active, `○` disconnected/inactive, `→` transitions on plan-edit cards, `↑` send button.
- No fire, runner, flex, or celebration emoji.

---

## Aesthetic direction

The metaphor: a coach's training notebook meets a sports timing display. Warm, physical, precise. The feeling of a well-worn Moleskine annotated in biro, combined with the authority of a Casio stopwatch.

Reject:
- Dark mode neon dashboards (Garmin, Whoop)
- Generic white SaaS minimalism (TrainingPeaks, Strava)
- Aggressive fitness-brand energy (any app with a bolt of lightning)
- Chart-heavy data dumps (Intervals.icu)

Embrace:
- Warm parchment tones — not white, not grey
- Editorial information density — clear hierarchy without visual noise
- Monospace data — all numbers look like split sheets
- Colour as semantic signal only — every colour use has a meaning

---

## Relationship to design system

`DESIGN_SYSTEM.md` translates this brand direction into concrete tokens, typography, component patterns, layout rules, and session-editor interaction rules. Do not invent new visual metaphors in product UI; preserve this notebook-plus-timing-display direction.
