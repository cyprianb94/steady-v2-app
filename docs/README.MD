# Steady

Steady is a plan manager for runners with their own plans, consolidating multiple tools into one app. It acknowledges that training never goes perfectly – niggles and injuries happen – and lets you easily adapt. Manage your plan solo, with a real coach, or with AI. Plus, generate injury timeline reports that actually help your physio visits.

**Key features**
- Bring your own plan in any format (manual, CSV, screenshot)
- Sync runs from Strava, Garmin, and Apple Health
- Planned vs actual tracking per session and across the block
- Injury phase mode with return-to-running progression
- Export your niggles, run history and injury history for your physio visit
- AI coach that initiates conversations — debriefs after key sessions, week previews every Monday
- Coach invite so a real human coach can see and edit the plan directly

## Stack

- **App:** React Native + Expo (iOS)
- **Backend:** Node.js + Fastify + Supabase
- **AI:** Anthropic Claude API
- **Built with:** Claude Code, Codex and Google Antigravity

## Status

Active development. v1 targets: plan import, block and week view, Strava sync, injury phase mode.

Landing page and waitlist: [steadybyop.vercel.app](https://steadybyop.vercel.app)

## Structure
packages/
types/    — shared TypeScript types
server/   — Fastify API + Supabase
app/      — React Native + Expo
landing/    — marketing site

## Development

```bash
npm run dev:server    # start Fastify on port 3000
npm run dev:app       # start Expo
npm run test:server   # run server tests
npm run build:types   # build shared types
```
