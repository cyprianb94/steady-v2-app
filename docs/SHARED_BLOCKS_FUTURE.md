# Future Concept: Shared Blocks

## Thesis

Shared Blocks should be Steady's lightweight distribution layer for training plans, not a marketplace.

The strongest version is simple: a trusted person, run club, coach, or runner shares a block; another runner previews it and adds an editable copy to Steady. The plan stays free. The sharing stays free. Paid value can sit around personalisation, AI reasoning, and professional coach or club workflow, not access to the block itself.

## Product Principle

Any runner can create, share, import, fork, and follow a training block for free.

This keeps Shared Blocks aligned with Steady's core promise: the app is a free training plan manager for runners who already have a plan. Shared Blocks expands where those plans can come from without turning Steady into a plan shop.

## What It Is

Shared Blocks is a share-by-link flow for training blocks.

- A creator builds a block in Steady.
- They make a shareable snapshot.
- They get an unlisted link and QR code.
- A runner opens a web preview.
- The runner taps `Add to Steady`.
- Steady imports an editable copy into the runner's account.

The key implementation rule is that shared blocks are copied, not subscribed to. If the original creator changes their block later, imported copies do not change.

## What It Is Not

The first version should not be a public marketplace.

Out of scope for the lightweight version:

- Search and browse.
- Public rankings.
- Ratings and comments.
- Paid promotion.
- Featured placement.
- Creator monetisation.
- Complex public profiles.
- Live subscription to someone else's changing plan.
- Version-syncing between creator and runner copies.
- A moderation-heavy public catalogue.

Those may become relevant later, but only after link-based sharing proves that people actually adopt and follow blocks.

## Why It Matters

Shared Blocks creates a cleaner acquisition loop than a generic app pitch.

A runner does not arrive because they vaguely want another running app. They arrive because their club, coach, or friend shared a specific block they already trust.

The hook is:

> This is the block your club is using. Add it to Steady and follow it from Monday.

That gives Steady distribution through existing running communities without charging for the plans themselves.

## Run Club Wedge

Run clubs already create consistency, but most members still ask some version of:

- What should I do between club runs?
- How do I train for a race without losing the social bit?
- How do I turn a weekly 5km or 10km meet-up into an actual block?

Shared Blocks lets a club turn its existing rhythm into a structured plan.

Example:

**Running Late Hackney Half block**

- 10 weeks.
- Wednesday 5km club run as a fixed easy/social anchor.
- Saturday 10km club run as a fixed long or steady anchor.
- Optional solo sessions around those anchors.
- Beginner, steady, and performance variants later.
- QR code at the cafe and links in Instagram or WhatsApp.

The club gets a better member experience. The runner gets structure. Steady gets high-intent users.

## Runlimited Angle

Runlimited could be interesting as a distribution and curation partner rather than just one club.

Potential angle:

> Runlimited curates London race blocks built with local run clubs. Steady powers the block preview, import, and weekly follow-through.

Possible pilots:

- A London Marathon block with club anchor runs.
- A Hackney Half block with East London clubs.
- A "first race block" for newer runners who already attend social runs.
- QR cards in-store next to shoes, race gear, or gait analysis.

The value for Runlimited is community infrastructure: not only selling product or listing clubs, but giving runners a structured way to train with those clubs.

## Coach Angle

Shared Blocks should not undermine real coaching.

For coaches, the language should be:

> Save the reusable structure. Personalise the runner.

Free:

- A runner can invite a coach into their own plan.
- A coach can share a basic block link.
- A runner can import and edit the block.

Potential paid professional layer later:

- Manage many runners.
- Reuse and organise templates.
- Bulk-adjust groups training for the same race.
- See adoption and adherence across invited runners.
- Branded onboarding links.
- Coach notes and athlete dashboards.

The runner-coach relationship should not be taxed. Professional workflow software can be paid if it saves coaches meaningful time.

## Monetisation Boundary

Shared Blocks should reinforce the free ethos.

The line:

> Plans stay free. Distribution stays free. The work around plans can be paid.

Free:

- Create a block.
- Share a block.
- Open a preview.
- Add a block to Steady.
- Edit the imported copy.
- Follow the block.
- Invite a real coach into your plan.

Paid:

- Steady AI adapting a shared block around missed sessions, injury, recent training, or goal changes.
- Steady AI debriefs and weekly previews.
- Professional coach tooling for managing multiple runners.
- Optional club/business tooling if it creates operational value, not access control.

Avoid:

- Charging runners to import a shared block.
- Charging clubs to publish a basic link.
- Paid ranking or featured placement.
- "Premium blocks" as the main business model.
- Any flow where a runner feels punished for not paying.

## Legal And Trust Guardrails

Training ideas, principles, and methods are different from copying a specific protected work.

The product should discourage direct recreation of named commercial plans or book tables unless the creator has permission. It should support original blocks inspired by general training principles, but avoid encouraging "Pfitzinger 18/55 copied into Steady" style sharing.

Potential creator confirmation:

> I have the right to share this block. It is my own plan or I have permission to publish it.

Potential product copy:

> Share original blocks, club blocks, or plans you have permission to publish. Do not upload copied tables from books, paid programmes, or private coaching plans.

## Lightweight MVP Scope

Minimum product:

- `Share block` action from an existing block.
- Creator adds title, short note, goal/race distance, length, and rough level.
- Steady creates an immutable snapshot.
- Creator gets an unlisted link.
- Web preview page shows enough to trust the block.
- `Add to Steady` deep link imports the block.
- If the app is not installed, the runner goes through install/signup and then returns to import.
- Imported block becomes the runner's editable copy.
- Creator can disable the link.
- Basic attribution travels with the imported block.

Preview page must answer:

- Who shared this?
- What is the goal?
- How long is it?
- What does a typical week look like?
- What sessions are fixed club sessions?
- What happens when I add it?

V1 does not need public discovery.

## Suggested Product Language

Feature name:

**Shared Blocks**

One-line description:

> Share a training block by link so another runner can add an editable copy to Steady.

Runner-facing preview:

> This block was shared by Running Late. Add a copy to Steady, set your start date, and adjust the sessions around your own week.

Creator-facing share screen:

> Anyone with this link can preview the block and add their own editable copy. Changes you make later will not affect their plan.

Import confirmation:

> Add this as a new block. You can edit every session after importing.

AI bridge:

> Want Steady AI to adapt this block around your recent training?

## Run Club Wording

### One-line pitch

Steady lets your club share a proper training block by QR code, so members can turn club runs into a plan they can actually follow.

### Short DM

Hey [name] — I am building Steady, a free training plan app for runners who already have a plan or train with a club.

One thing I am exploring is Shared Blocks: a run club can create a 6-12 week block, share it by QR code or Instagram link, and members can add an editable copy to Steady for free.

The interesting bit is that your existing club runs can become the anchors of the block. So instead of members wondering what to do between sessions, the club gives them a simple structure around the runs they already attend.

Would be useful to get your take on whether this would help your members, especially around race prep.

### 60-second meeting pitch

The idea is not to sell training plans. Steady stays free for runners.

What I am trying to solve is the gap between social running and structured training. Lots of people join a run club, love the consistency, then sign up for a half or marathon and still do not know what to do outside the weekly club runs.

Shared Blocks would let a club publish a simple training block around its existing rhythm. Members scan a QR code, preview the block, and add it to Steady as their own editable plan. The club run stays the centre of the week, and the rest of the plan fills in around it.

I am trying to understand whether that would be genuinely useful for your members, and what kind of block would feel credible coming from your club.

### Questions to ask clubs

- Do members ask what they should do between club runs?
- Do people train for races together informally already?
- Are there races where a shared block would naturally fit your calendar?
- Would your club want one general block or multiple levels?
- Which sessions should be fixed club anchors?
- Would a QR code in-person be useful, or is Instagram/WhatsApp the real channel?
- What would make this feel useful rather than like admin?
- Would you want to see how many members imported the block?
- Would you want the club name on the block?
- Would you be comfortable sharing a block publicly if it stayed free?

### Pilot ask

I am not asking you to commit to a platform. I want to prototype one block around a real race or club rhythm, give you a preview link and QR code, and see whether members understand it and want to add it.

### Objection handling

If they say they are not coaches:

> That is fine. The block does not need to pretend to be personalised coaching. It can simply give members a sensible structure around the runs your club already does.

If they worry about liability:

> The block can be clearly positioned as a general training structure, not medical advice or a personalised prescription. Runners can edit it, and coaches can still personalise plans where needed.

If they worry about effort:

> The first pilot should be small. One block, one race, one link. I would help shape it and you would sanity-check whether it feels like your club.

If they ask how Steady makes money:

> The shared block stays free. Steady may charge for AI personalisation or professional coach tooling later, but the club block itself is not the product being sold.

## First Pilot Concepts

### Running Late

Concept:

**Running Late Hackney Half block**

Positioning:

> Built around Wednesday and Saturday club runs, with optional solo sessions to turn weekly consistency into race preparation.

Why it fits:

- Existing ritual.
- Clear physical location.
- Natural QR code use.
- Social running plus race prep.
- East London race relevance.

### Runlimited

Concept:

**London race block hub**

Positioning:

> Curated race blocks from London running communities, powered by Steady.

Why it fits:

- Runlimited already operates around clubs, product, and London running culture.
- It can become a connective layer across clubs.
- Shared Blocks give them a concrete member utility beyond content and retail.

## Wireframe Story

The high-fidelity wireframe should show four moments:

1. Public preview from a QR code or link.
2. Import screen where the runner adds an editable copy.
3. The imported block inside Steady.
4. The creator share sheet with link, QR code, and simple controls.

The visual story should make the constraint obvious: this is sharing, not a marketplace.

## Success Metrics

Early metrics:

- Link views.
- Import conversion.
- App installs from shared block links.
- Signup completion after shared block entry.
- Blocks followed into week 2.
- First synced run after import.
- Club members who keep the club anchor sessions.
- Number of creators who share more than one block.

Qualitative signals:

- Clubs can explain the value back in their own words.
- Runners understand that the imported block is editable.
- No one asks where the marketplace is.
- No one assumes the block is paid.
- Coaches do not feel replaced.

## Phased Roadmap

### Phase 1: Link-based sharing

One creator. One unlisted link. One immutable snapshot. One editable import.

### Phase 2: Club pilots

Add club attribution, QR codes, and minimal creator stats for selected pilot partners.

### Phase 3: Reusable creator tools

Let clubs and coaches organise templates and reuse blocks without creating a public catalogue.

### Phase 4: Block Library

Only consider searchable discovery if link-based sharing is already working organically.

## Decision

Keep Shared Blocks post-MVP, but define it narrowly.

Do not build a marketplace first. Build the share primitive first.

The first useful version is small enough to be plausible after MVP, and strategically valuable because it creates a distribution loop through trusted running communities while preserving the free product ethos.
