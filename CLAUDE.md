# Steady v2

Monorepo with three packages: `packages/types`, `packages/server`, `packages/app`.

## Commands

- **Run server tests:** `npm run test:server`
- **Typecheck server:** `npx tsc --noEmit -p packages/server/tsconfig.json`
- **Typecheck app:** `npx tsc --noEmit -p packages/app/tsconfig.json`
- **Build types:** `npm run build:types`
- **Start Expo:** `npm run dev:app`
- **Start Fastify:** `npm run dev:server`

## Project Skills

Project-local skills live in `.claude/skills/`.
Use [docs/README.md](/Users/cyprianbrytan/Projects/steady-v2-app/docs/README.md) as the canonical guide for when to use them and in what order.

## <verification_workflow>

When code has been edited while a preview server is running, verify changes are safe:

1. **If server code changed** (`packages/server/`): run `npm run test:server` — all tests must pass.
2. **If app code changed** (`packages/app/`): run `npx tsc --noEmit -p packages/app/tsconfig.json` — must produce no errors.
3. **If types changed** (`packages/types/`): run `npm run build:types` first, then repeat steps 1 and 2.
4. **If preview is Expo** (port 8081): check the terminal for Metro bundler errors after the typecheck passes.
5. **If preview is Fastify** (port 3000): run `curl -s http://localhost:3000/health` to confirm the server is still responding.

Only proceed once all relevant checks pass. If any check fails, fix the issue before continuing.

</verification_workflow>
