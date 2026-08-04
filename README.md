# SkillHub Local

Local web app for managing AI agent skills across your PC.

<img width="1855" height="868" alt="image" src="https://github.com/user-attachments/assets/0460e9d4-f49a-4bf9-8daf-730819ef844d" />


## Features

### Agent Detection
- Auto-detects 16 AI agents on your system: Claude Code, Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Cline, Amp, Continue, Roo Code, Goose, Antigravity, Hermes, Zed, Warp
- Shows detection status, installed skill count, and plugin count per agent

### Skill Management
- Scans installed skills across all agents via filesystem, parses SKILL.md with gray-matter
- Install, remove, and update skills via `npx skills` CLI with live WebSocket progress
- Copy or symlink skills between agents with one click
- Skill detail page with per-agent install status and raw SKILL.md content

### Skill Store
- Browse and search the skills.sh registry (950K+ installs ecosystem)
- Trending and curated skill listings
- One-click install to all detected agents

### Agent Matrix
- Cross-reference table showing which skills are installed in which agents
- Copy missing skills to agents directly from the matrix

### Memories
- Scans AI-learned context files from Codex, Claude Code, Windsurf, Cline, and Gemini CLI
- Global and project-scoped memories with agent grouping
- Inline editor with dirty tracking and save support (read-only for Gemini CLI transcripts)
- Re-scan button for on-demand refresh

### Instructions
- Scans user-authored rules and instruction files across 12+ agents (Claude Code, Cursor, Copilot, Windsurf, Cline, Aider, Gemini CLI, Amazon Q, JetBrains Junie, Augment, and AGENTS.md)
- Global and project-scoped with per-project grouping
- Detects YAML frontmatter badges
- Inline editor with dirty tracking and save support
- Configurable project directories for project-scoped discovery

### Plugin Detection
- Detects plugins installed in agent-specific cache directories (Cursor, Codex)
- Plugin skills appear in the skills list as `plugin-name:skill-name` with a plugin badge
- Expandable plugin cards to browse skills inside each plugin
- Custom plugin configuration via `skillhub.config.json` (source, agent, hook types)

### Dashboard
- Overview with stat cards (agents detected, total skills, plugins, memories, instructions, trending)
- Real-time activity feed from WebSocket events
- Recent context feed showing latest memories and instructions

### Settings
- Default scope (global/project), install method (symlink/copy), theme (system/dark/light), telemetry
- Project directories with native OS folder picker (macOS Finder, Windows Explorer, Linux zenity/kdialog)
- Auto-save with instant rescan on changes

## Setup

Requires [Node.js](https://nodejs.org/) (v18+).

Install the [skills](https://www.npmjs.com/package/skills) CLI (used for install/remove/update/search):

```bash
npm install -g skills
```

SkillHub Local prefers a globally installed `skills` binary; if it's missing it falls back to `npx skills` (or `npx skills@<version>` via the `SKILLHUB_SKILLS_VERSION` env var).

Install and run:

```bash
npm install -g skillhub-local
skillhub-local
```

- **App:** `http://localhost:3742`
- **Development from source:** `git clone https://github.com/mjalalimanesh/skillhub-local.git && cd skillhub-local && npm install && npm run dev` (frontend on `:5173`, backend on `:3742`, Vite proxies `/api` and `/ws`)

> **Security note:** Installing a skill runs its code on your machine. Only install skills from sources you trust.

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
│       │   ├── memories/    # MemoriesPage, AgentMemoriesPage, MemoryDetailPage
│       │   ├── instructions/# InstructionsPage, ProjectInstructionsPage, InstructionDetailPage
│       │   ├── settings/    # SettingsPage (scope, method, theme, telemetry, project dirs)
│       │   ├── layout/      # Layout, Sidebar, PageHeader
│       │   └── ui/          # Radix-based primitives (button, card, badge, dialog, etc.)
│       ├── hooks/         # useWebSocket
│       ├── stores/        # Zustand state (agents, skills, progress)
│       └── lib/           # API client, types, utils
└── backend/               # Fastify server
    └── src/
        ├── routes/        # REST endpoints (agents, skills, config, memories, instructions, browse)
        └── services/      # Scanner, CLI executor, store API, plugins, memory-scanner, instruction-scanner
```


