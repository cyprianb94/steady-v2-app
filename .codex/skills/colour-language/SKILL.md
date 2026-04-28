---
name: colour-language
description: Use when making Steady semantic colour decisions, adding metric colour tokens, changing run-detail visual language, designing charts/tables/metric cards, or reviewing whether UI colour use is meaningful, restrained, and consistent across phase, session, metric, status, and action namespaces.
---

# Steady — Colour Language

Use this skill with `/brand-and-content` and `/design-system` whenever colour decisions affect app UI, data visualisation, run analysis, planned-vs-actual surfaces, or support logging flows.

## Core Rule

Colour is semantic signal, not decoration.

Steady colour must answer exactly one of these questions:

| Namespace | Question | Examples |
|---|---|---|
| Surface | Where does the UI sit? | cream, surface, card, border |
| Phase | Where is this in the training block? | base, build, recovery, peak, taper |
| Session | What kind of session was planned? | easy, interval, tempo, long, rest |
| Metric | What kind of number is this? | distance, time, pace, heart rate |
| Status | What is Steady's judgement? | completed, varied, missed |
| Action | What can the runner do? | save, add, change |

Do not let one colour casually cross namespaces. If the meaning is unclear, use neutral ink/muted/border instead.

## Existing Namespaces

Keep these existing systems intact.

### Session colours

Use for session identity: dots, session tags, session cards, day rows, planned workout markers.

| Session | Colour |
|---|---|
| Easy | forest `#2A5C45` |
| Interval | clay `#C4522A` |
| Tempo | amber `#D4882A` |
| Long | navy `#1B3A6B` |
| Rest | slate `#8A8E9A` |

### Phase colours

Use for block-level structure only: phase strips, phase tags, block rows, recovery/block context.

| Phase | Colour |
|---|---|
| Base | navy `#1B3A6B` |
| Build | clay `#C4522A` |
| Recovery | purple `#7C5CBF` |
| Peak | amber `#D4882A` |
| Taper | forest `#2A5C45` |

### Status colours

Use for judgement and state, not data type.

| Status | Colour |
|---|---|
| Completed / connected / saved | forest `#2A5C45` |
| Varied / off target / needs review | amber `#D4882A` |
| Missed / failed / injury caution | clay `#C4522A` |
| Upcoming / inactive | border or muted |
| Today | clay accent |

## Metric Colours

Use metric colours for values, table columns, chart lines, and bars. Labels usually stay muted; cards usually stay parchment.

| Metric | Colour | Meaning |
|---|---|---|
| Distance / volume | cobalt `#3D55A4` | kilometres, mileage, volume, distance covered |
| Time / duration | brass `#9D711F` | elapsed time, duration, workout time |
| Pace / speed | teal `#187F7A` | pace, speed, split execution, pace bars |
| Heart rate | coral `#BD433B` | BPM, physiological load, strain |
| Elevation | moss `#607B38` | climbing, hills, terrain |
| Effort / feel | plum `#765098` | subjective feel, RPE, runner judgement |
| Cadence / form | steel `#64717A` | cadence, mechanics, form detail |
| Fuelling | copper `#A5612F` | gels, carbs, intake timing |
| Shoes / kit | blue-grey `#577080` | equipment, shoe lifecycle, kit mileage |

Metric colours do not mean good or bad. A bad pace is still pace teal. A high heart rate is still heart-rate coral. Put judgement in a separate status treatment.

## Anti-Rainbow Rules

1. Default to neutral. Colour must earn its place.
2. Colour values and bars, not the furniture. Keep labels muted and cards parchment.
3. Do not tint full card backgrounds unless the card's entire purpose is one semantic category.
4. Keep unselected controls neutral. Only recorded or selected values carry semantic colour.
5. Separate metric colour from status colour. Do not turn pace red because it was poor.
6. Keep phase colour macro and session colour micro. Do not add phase decoration to run detail unless the surface is explicitly about the block.
7. Avoid showing every metric colour in a support section. Support cards should usually have one accent at most.
8. If two paired metrics are visually confusable, push them into different hue families. Distance must stay cobalt, not teal-adjacent.

## Run Detail Pilot

Run detail is the testing ground for this language. Do not roll the system across the app until this pilot has been implemented and reviewed.

Reference artifact:
- `wireframes/run-detail-colour-language/index.html`
- `wireframes/run-detail-colour-language/run-detail-colour-language.png`

Pilot scope:
- Add semantic metric colour tokens.
- Apply metric colours to existing run detail values and bars.
- Keep existing product behaviour and layout.
- Do not add new analysis features.

Explicitly excluded from the pilot:
- phase timeline in run detail
- new pace/heart-rate chart
- derived planned-vs-actual insight chips
- new Steady AI readout cards
- new behaviour or data calculations beyond styling the current surface

### Run detail mapping

Top metrics:
- Distance value: cobalt.
- Duration value: brass.
- Avg pace value: teal.
- Avg heart rate value: coral.
- Max HR sub-metric: coral.
- Elevation sub-metric: moss.
- Matched-to-session pill: status-connected forest, because it means the run is linked/matched; do not use interval/session colour here.
- Metric-card side rails may use the same metric colour as a thin accent, but they must stay secondary to the value text.

Planned vs actual:
- Distance planned/actual: cobalt.
- Pace planned/actual: teal.
- Effort target text: plum.
- Varied/review badge: status amber.
- Keep row structure; do not add extra derived chips for now.

Splits:
- Distance column: cobalt.
- Pace column: teal.
- HR column: coral.
- Pace bar fill: teal.
- Pace bar track: pale teal.
- Grey vertical marker: run average pace reference.
- Meaning: longer teal fill means faster relative to the splits shown; fill past the grey marker is faster than average, fill short of the marker is slower than average.

Feel:
- Keep unselected chips neutral.
- Colour only the selected recorded answer.
- Calm/recoverable selected answers use effort plum.
- Harder selected answers may use amber.
- Extreme caution selected answers may use clay.
- Do not colour every option in the answer bank.

Support sections:
- Shoes: blue-grey on lifetime value/chip and equipment-specific emphasis only.
- Fuelling: copper on gel count, timing dots, and add-gel control.
- Niggles: clay because this is body caution.

## Implementation Workflow

1. Read `/brand-and-content` and `/design-system`.
2. Confirm the colour namespace for each UI element before changing it.
3. Add/consume semantic tokens instead of sprinkling raw hex values.
4. Pilot in Run detail only.
5. Screenshot compare against the wireframe and check whether the screen is more scannable without feeling louder.
6. If the result feels too colourful, reduce support-section colour first; preserve the core metric language for distance, time, pace, and heart rate.

## Review Checklist

- Can a runner distinguish distance from pace before reading labels?
- Are labels still muted and values carrying the signal?
- Is session clay only used for interval/session identity or true clay status/action meanings?
- Are phase colours absent from run detail unless the feature explicitly needs block context?
- Are status colours separate from metric colours?
- Are unselected controls neutral?
- Did the change avoid new product functionality?
