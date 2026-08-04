# AGENTS.md

## Project

Monorepo: `packages/frontend` (React SPA) + `packages/backend` (Fastify server). The root package is the `skillhub-local` npm CLI (`bin: packages/backend/dist/index.js`) — the backend entrypoint doubles as a global CLI and can be installed via `npm i -g .`.

## Commands

```bash
npm run dev          # Start both frontend (5173) and backend (3742) concurrently
npm run build        # Build both packages (frontend first, then backend)
npm run start        # Build, then run node packages/backend/dist/index.js
npm publish          # Publishes skillhub-local as a global npm CLI (prepublishOnly runs build)
```

Per-package:
```bash
cd packages/frontend && npm run typecheck   # tsc --noEmit
cd packages/backend && npm run typecheck    # tsc --noEmit
```

No test suite exists. No linter beyond TypeScript. No CI workflows.

## Architecture

- Frontend: Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + Radix UI + Zustand + React Query + React Router 7 + lucide-react
- Backend: Fastify 5 + WebSocket (ws) + gray-matter (SKILL.md/AGENTS.md frontmatter) + smol-toml (MCP configs) + marked (rendering) + `@modelcontextprotocol/sdk` (live MCP tool discovery)
- Backend runs on `127.0.0.1:3742` (env: `PORT`, `HOST`), frontend dev server on `localhost:5173`
- Vite proxies `/api` and `/ws` to backend during development
- In production, backend serves `packages/frontend/dist` as static files with SPA fallback
- Pages (React Router): Dashboard, Skills, Skill detail, Matrix, Agents, Store, MCP + MCP detail, Instructions, Memories, Plugins, Settings

## Key Conventions

- Path alias: `@/` → `./src/` in frontend (configured in vite.config.ts and tsconfig.json)
- All imports use `.js` extensions in backend (ESM with `"type": "module"`)
- Backend routes in `packages/backend/src/routes/*.ts` (agents, skills, config, health, memories, instructions, browse, auth, mcp); logic in `src/services/*.ts`
- Frontend state: Zustand store at `src/stores/app.ts`; all backend calls go through `src/lib/api.ts` (`api.*` methods, attaches auth token)
- Content scanners: `scanner.ts` (skills), `mcp-scanner.ts`, `instruction-scanner.ts`, `memory-scanner.ts`
- Agent/skill store: `services/store-api.ts`, plugin management via `services/plugins.ts` + `installed-plugins.ts`, file access via `services/trusted-dirs.ts` (dirs must be trusted before writing)
- Real-time progress (installs/removes, MCP tool calls) via WebSocket events

## Auth (critical)

- Token is generated on first run, persisted at `~/.skillhub/token` (chmod 0600)
- Every `/api/*` request except `/api/auth/token` and `/api/health` must send header `x-skillhub-token: <token>`
- WebSocket at `/ws?token=<token>` — token is required in the query string (CORS does not protect raw WebSockets)
- Startup logs the token to stdout

## Gotchas

- Backend serves frontend from `../../frontend/dist` relative to its src — overridable with env `SKILLHUB_FRONTEND_DIST`
- `npm run lint` and `npm run typecheck` are the same command (`tsc --noEmit`) in both packages
- No `opencode.json`, `.cursorrules`, or other agent instruction files exist
- Build artifacts are committed for `npm publish` to work without CI (`dist/` in both packages is kept in git)
