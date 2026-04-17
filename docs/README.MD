# Steady

Steady is an iOS beta for runners who already have a plan. The current beta is focused on the core loop: build the plan in app, see the current week and block clearly, sync Strava runs back to the plan, and handle injury/recovery without losing context.

**Current beta features**
- Build a plan in app with the plan builder
- Today, Week, and Block views for the current training block
- Strava sync
- Planned vs actual tracking per session
- Recovery mode with return-to-running progression and resume-week choice

**Not in beta yet**
- CSV or screenshot/photo plan import
- Apple Health or Garmin sync
- Coach invite / coach collaboration
- Proactive Steady AI debriefs, weekly previews, or paid packaging
- Physio export reports

## Stack

- **App:** React Native + Expo (iOS)
- **Backend:** Node.js + Fastify + Supabase
- **AI:** Anthropic Claude API
- **Built with:** Claude Code, Codex and Google Antigravity

## Status

Active development. Current beta focus: in-app plan builder, block and week view, Strava sync, planned vs actual, and recovery mode.

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
npm run dev:app       # start Expo in LAN mode for Expo Go on the current Wi-Fi
npm run test:server   # run server tests
npm run build:types   # build shared types
```
