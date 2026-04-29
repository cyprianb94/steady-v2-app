# Long Run Quality — Wireframes

Static design exploration for long runs with embedded quality, based on the current plan-builder, review-block, and session-editor screenshots.

Open [`index.html`](index.html) directly in a browser. No build step is required. A rendered preview is also available at [`long-run-quality.png`](long-run-quality.png).

## Screens

| # | Frame | Purpose |
|---|---|---|
| 01 | Template week stays light | Keeps Step 5 focused on weekly structure while marking Sunday as a quality-capable long-run slot |
| 02 | Review shows generated specificity | Shows exact long-run blocks after plan generation, inside the existing Weeks tab pattern |
| 03 | Long-run editor adds a structure row | Keeps the top-level session type as `LONG` and adds long-run style/structure fields |
| 04 | Structure editor handles the details | Provides a deeper block editor only when the user chooses to edit the internal run structure |

## Design intent

- Do not add a sixth session type for this. The session role remains `LONG`.
- Let the generated plan vary the internal blocks by phase and week.
- Avoid turning onboarding into a full workout builder.
- Make the higher stress visible in review and edit contexts because this long run also behaves like a quality stimulus.
