# SkillHub Local

Local web app for managing AI agent skills across your PC.

## What it does

- Auto-detects 16+ AI agents (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, etc.)
- Scans installed skills via filesystem, parses SKILL.md with gray-matter
- Installs/removes/updates via `npx skills` CLI with live WebSocket progress
- Browses skills.sh store via CLI search (950K+ installs ecosystem)
- Skill detail page with per-agent install status
- Agent matrix view (skill × agent cross-reference)
- Copy skills between agents with one click
- Plugin system with custom sources, agents, hooks via `skillhub.config.json`

## Setup

```bash
# Install dependencies
cd packages/frontend && npm install
cd ../backend && npm install
cd ../..

# Development (both servers)
npm run dev

# Production
npm run build
npm run start
```

Backend runs on `http://localhost:3742`. Frontend proxies to it in dev mode.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend:** Fastify 5 + WebSocket + gray-matter
- **CLI:** `npx skills` (non-interactive flags)
- **Store:** `npx skills find` CLI search

## Project Structure

```
packages/
├── frontend/          # Vite + React SPA
│   └── src/
│       ├── components/  # Dashboard, Agents, Skills, Store, Plugins, Settings
│       ├── hooks/       # useWebSocket
│       ├── stores/      # Zustand state
│       └── lib/         # API client, types, utils
└── backend/           # Fastify server
    └── src/
        ├── routes/      # REST endpoints
        └── services/    # Scanner, CLI executor, store API, plugins
```
