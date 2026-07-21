# AGENTS.md

## Project

Monorepo: `packages/frontend` (React SPA) + `packages/backend` (Fastify server).

## Commands

```bash
npm run dev          # Start both frontend (5173) and backend (3742) concurrently
npm run build        # Build both packages (frontend first, then backend)
npm run start        # Production: serves backend which also serves frontend static files
```

Per-package:
```bash
cd packages/frontend && npm run typecheck   # tsc --noEmit
cd packages/backend && npm run typecheck    # tsc --noEmit
```

No test suite exists. No linter beyond TypeScript. No CI workflows.

## Architecture

- Frontend: Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + Radix UI + Zustand + React Query
- Backend: Fastify 5 + WebSocket (ws) + gray-matter for SKILL.md parsing
- Backend runs on `127.0.0.1:3742`, frontend dev server on `localhost:5173`
- Vite proxies `/api` and `/ws` to backend during development
- In production, backend serves `packages/frontend/dist` as static files with SPA fallback

## Key Conventions

- Path alias: `@/` → `./src/` in frontend (configured in vite.config.ts and tsconfig.json)
- All imports use `.js` extensions in backend (ESM with `"type": "module"`)
- Frontend state: Zustand store at `src/stores/app.ts`
- API client: `src/lib/api.ts` — all backend calls go through `api.*` methods
- Skills are scanned from filesystem via `packages/backend/src/services/scanner.ts`
- Real-time install/remove progress via WebSocket events

## Gotchas

- Backend serves frontend from `../../frontend/dist` relative to its src — path is hardcoded in `index.ts`
- `npm run lint` and `npm run typecheck` are the same command (`tsc --noEmit`) in both packages
- No `opencode.json`, `.cursorrules`, or other agent instruction files exist
