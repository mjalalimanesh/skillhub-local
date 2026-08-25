# SkillHub Local

**One local dashboard for all your AI coding agents.**

<img width="1768" height="860" alt="image" src="https://github.com/user-attachments/assets/9449cc2a-1ec7-4f28-b90e-96cd0cc89d55" />


Skills · Memories · Instructions · Plugins · MCP Servers
_Claude Code · Codex · Cursor · OpenCode · Gemini CLI · Copilot · Windsurf · Cline and more_

Using Claude + Codex + Cursor? Your agent context is probably scattered across a dozen hidden folders. SkillHub Local puts all of it — skills, memories, instructions, plugins, and MCP servers — in one place you can actually see and manage.

## Install

Requires Node.js (v18+).

SkillHub uses the [skills](https://www.npmjs.com/package/skills) CLI under the hood for install/remove/update/search. It prefers a globally installed binary and falls back to `npx skills` (or `npx skills@<version>` via `SKILLHUB_SKILLS_VERSION`):

```bash
npm install -g skills
```

Then install SkillHub:

```bash
npm install -g skillhub-local
skillhub-local
```

Open `http://localhost:3742`. That's it.

## What you can do

### See everything

What skills, memories, and instructions does Claude Code have right now? What MCP servers are configured in Cursor? SkillHub scans your filesystem and shows it all in one dashboard — no more grepping through `~/.claude`, `~/.codex`, and `~/.cursor`.

### Move context between agents

Found a useful skill in Claude but want it in Codex? Copy or symlink it with one click. The agent matrix shows which skills live where, and fills the gaps directly.

### Clean up the mess

Surf stale memories, duplicate skills, and instruction files spread across projects. Spot what's global vs. project-scoped, what's installed where, and tidy it up from a single view.

---

## Features

- **Agent detection** — auto-detects 16 agents (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Cline, Amp, Continue, Roo Code, Goose, Antigravity, Hermes, Zed, Warp), showing install status plus skill and plugin counts per agent
- **Projects** — point SkillHub at your code folders (Settings → Project Directories); each subdirectory becomes a project showing its skills, AGENTS.md files, memories, and MCP servers in one view
- **Skill management** — scan global **and** per-project skills (`.claude/skills`, `.agents/skills`, `.roo/skills`, … parsed from `SKILL.md`), install, remove, update, copy/symlink between agents, with per-agent install status and raw content editing
- **Skill store** — browse and search the skills.sh registry, one-click install to all detected agents
- **MCP servers** — scan server configs (JSON/JSONC/TOML) across 10 agents, live tool discovery, OAuth flow, and per-server header/env credential overrides
- **Memories** — scan AI-learned context from Codex, Claude Code, Windsurf, Cline, and Gemini CLI; global and project-scoped, with inline editing and re-scan
- **Instructions** — scan user-authored rules across 12+ agents and `AGENTS.md`, with YAML frontmatter badges, inline editing, and configurable project directories
- **Plugins** — detect plugins in agent cache directories (Cursor, Codex), browse skills inside each plugin, and configure custom plugins via `skillhub.config.json`
- **Dashboard** — stat cards, real-time activity feed over WebSocket, and a recent-context feed
- **Settings** — default scope, install method (symlink/copy), theme, telemetry, and project directories with a native OS folder picker

## Setup details

Development from source:

```bash
git clone https://github.com/mjalalimanesh/skillhub-local.git
cd skillhub-local
npm install
npm run dev
```

Frontend on `:5173`, backend on `:3742`; Vite proxies `/api` and `/ws`.

> **Security note:** Installing a skill runs its code on your machine. Only install skills from sources you trust.

## Authentication

SkillHub binds to `127.0.0.1` and protects every API endpoint with a token generated on first run and stored at `~/.skillhub/token` (mode `0600`).

- Every `/api/*` request (except `/api/auth/token` and `/api/health`) requires the header `x-skillhub-token: <token>`
- WebSocket connections pass the token in the query string: `/ws?token=<token>`
- The token is logged to stdout on startup

This guards against malicious sites reaching the local server, since CORS does not block raw WebSocket or non-browser requests.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3742` | Backend listen port |
| `HOST` | `127.0.0.1` | Backend bind address |
| `SKILLHUB_FRONTEND_DIST` | `../../frontend/dist` | Override the production frontend build path |
| `SKILLHUB_SKILLS_VERSION` | — | Pin the `skills` CLI version used via `npx` |
| `SKILLHUB_LOG` | off | Enable request logging (`1` for info, or a pino level) |

## Tech Stack

- **Frontend:** Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + Radix UI + Zustand + React Query
- **Backend:** Fastify 5 + WebSocket (ws) + gray-matter + smol-toml + marked
- **MCP:** `@modelcontextprotocol/sdk` (live tool discovery, OAuth flow)
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
│       │   ├── projects/    # ProjectsPage, ProjectDetailPage (per-project context)
│       │   ├── store/       # StorePage (search, trending, install)
│       │   ├── mcp/         # McpPage, McpDetailPage (servers, tool discovery, OAuth)
│       │   ├── plugins/     # PluginsPage (detected + custom plugins, expandable)
│       │   ├── memories/    # MemoriesPage, AgentMemoriesPage, MemoryDetailPage
│       │   ├── instructions/# InstructionsPage, ProjectInstructionsPage, InstructionDetailPage
│       │   ├── settings/    # SettingsPage (scope, method, theme, telemetry, project dirs)
│       │   ├── layout/      # Layout, Sidebar, PageHeader
│       │   └── ui/          # Radix-based primitives (button, card, badge, dialog, etc.)
│       ├── hooks/         # useWebSocket
│       ├── stores/        # Zustand state (agents, skills, progress)
│       └── lib/           # API client, types, utils
└── backend/               # Fastify server (also the skillhub-local CLI entrypoint)
    └── src/
        ├── routes/        # REST endpoints (agents, skills, projects, config, memories, instructions, browse, mcp, auth, health)
        └── services/      # Scanner, CLI executor, store API, plugins, memory/instruction/mcp scanners, mcp client + OAuth
```
