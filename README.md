# SkillHub Local

Local web app for managing AI agent skills across your PC.

## Features

### Agent Detection
- Auto-detects 16 AI agents on your system: Claude Code, Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Cline, Amp, Continue, Roo Code, Goose, Antigravity, Hermes, Zed, Warp
- Shows detection status, installed skill count, and plugin count per agent

### Skill Management
- Scans installed skills across all agents via filesystem, parses SKILL.md with gray-matter
- Install, remove, and update skills via `npx skills` CLI with live WebSocket progress
- Copy or symlink skills between agents with one click
- Skill detail page with per-agent install status and raw SKILL.md content

### Plugin Detection
- Detects plugins installed in agent-specific cache directories (Cursor, Codex)
- Plugin skills appear in the skills list as `plugin-name:skill-name` with a plugin badge
- Expandable plugin cards to browse skills inside each plugin
- Custom plugin configuration via `skillhub.config.json` (source, agent, hook types)

### Agent Matrix
- Cross-reference table showing which skills are installed in which agents
- Copy missing skills to agents directly from the matrix

### Skill Store
- Browse and search the skills.sh registry (950K+ installs ecosystem)
- Trending and curated skill listings
- One-click install to all detected agents

### Dashboard
- Overview with stat cards (agents detected, total skills, plugins, trending)
- Real-time activity feed from WebSocket events

### Settings
- Default scope (global/project), install method (symlink/copy), theme (system/dark/light), telemetry

## Setup

```bash
npm install
npm start
```

- **App:** `http://localhost:3742`
- **Development:** `npm run dev` (frontend on `:5173`, backend on `:3742`, Vite proxies `/api` and `/ws`)

## Tech Stack

- **Frontend:** Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + Radix UI + Zustand + React Query
- **Backend:** Fastify 5 + WebSocket (ws) + gray-matter
- **CLI:** `npx skills` (non-interactive flags for install/remove/update/copy)
- **Store:** skills.sh registry via CLI search + HTTP API

## Project Structure

```
packages/
├── frontend/              # Vite + React SPA
│   └── src/
│       ├── components/
│       │   ├── dashboard/   # DashboardPage (stats, activity feed)
│       │   ├── skills/      # SkillsPage, SkillDetailPage, MatrixPage, CopyToAgentsDialog
│       │   ├── agents/      # AgentsPage (agent cards with skill/plugin counts)
│       │   ├── store/       # StorePage (search, trending, install)
│       │   ├── plugins/     # PluginsPage (detected + custom plugins, expandable)
│       │   ├── settings/    # SettingsPage (scope, method, theme, telemetry)
│       │   ├── layout/      # Layout, Sidebar, PageHeader
│       │   └── ui/          # Radix-based primitives (button, card, badge, dialog, etc.)
│       ├── hooks/         # useWebSocket
│       ├── stores/        # Zustand state (agents, skills, progress)
│       └── lib/           # API client, types, utils
└── backend/               # Fastify server
    └── src/
        ├── routes/        # REST endpoints (agents, skills, config, health)
        └── services/      # Scanner, CLI executor, store API, plugins, installed-plugins
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/agents` | List detected agents with skill/plugin counts |
| GET | `/api/agents/:id/skills` | Skills for a specific agent |
| GET | `/api/agents/:id/skills/:name` | Single skill detail + SKILL.md content |
| GET | `/api/skills` | List all skills (filterable by `?agent=` and `?scope=`) |
| POST | `/api/skills/install` | Install a skill (WebSocket progress) |
| POST | `/api/skills/remove` | Remove a skill |
| POST | `/api/skills/update` | Update skills |
| POST | `/api/skills/copy` | Copy/symlink skill to target agents |
| GET | `/api/skills/search?q=` | Search skills.sh registry |
| GET | `/api/skills/trending` | Trending skills |
| GET | `/api/skills/curated` | Curated skills from skills.sh |
| GET | `/api/config` | Load config (plugins + preferences) |
| PUT | `/api/config` | Save config |
| POST | `/api/plugins` | Add custom plugin |
| DELETE | `/api/plugins/:type/:name` | Remove custom plugin |
| PUT | `/api/preferences` | Update user preferences |
| GET | `/api/installed-plugins` | Detect plugins on disk |
