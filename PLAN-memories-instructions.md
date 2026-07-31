# Plan: Memories + Instructions Features

## Overview

Two new sidebar items under a new **"Context"** section:
- **Memories** — auto-generated AI-learned context files
- **Instructions** — user-authored rules and instruction files

Config files (`.aider.conf.yml`, `opencode.json`, etc.) skipped for now.

---

## Project Directory Support (NEW)

Users configure one or more project root folders in Settings. Each folder is scanned **one level deep**: its immediate subdirectories are treated as separate projects. Effective project count and file count are capped; dotdirs and noise dirs are skipped.

### Config

`skillhub.config.json` (owned by `packages/backend/src/services/plugins.ts`) gains a field:
```jsonc
{
  "version": 1,
  "plugins": [],
  "preferences": { ... },
  "projectDirs": []      // NEW: absolute paths, e.g. ["D:\\code", "~/repos"]
}
```
- Default `[]` (project scope silently empty, matching today's behavior).
- `loadConfig` / `saveConfig` already merge arbitrary fields, but add explicit typing in `PluginConfig`.
- Settings page gets a "Project directories" multi-path picker (add/remove rows, expand `~`).

### Scanning rules (apply to both scanners)

- For each entry `p` in `projectDirs`:
  - Skip if missing or not a directory.
  - Resolve immediate child dirs of `p` → each child is one effective project (depth = 1).
  - Project files located at `<child>/<agent-relative-path>` (e.g. `<child>/.cursorrules`, `<child>/.github/copilot-instructions.md`).
  - A configured entry with no subdirs containing agent files yields **zero** projects (the dir itself is not treated as a project).
- `projectId = hash(relPath)`, `projectName = basename(child)`, `projectRoot = child` (absolute).
- **Caps**: max 200 effective projects across all entries; max 5000 files. Skip dirs named `.git`, `.svn`, `node_modules`, `dist`, `build`, `out`, `.next`, `.cache`, `.turbo`, `target`, `venv`, `.venv`, `__pycache__`, `.idea`, `.vscode` (note: `.cursor`, `.claude`, `.windsurf`, etc. are payload dirs and are NOT skipped).
- **Scan control**: list endpoints use React Query with `staleTime: Infinity` + a "Re-scan" button that calls `queryClient.invalidateQueries`. No auto-refetch on mount.

---

## Sidebar Structure

```
Overview
  Dashboard
  Matrix
Context                          <- NEW section
  Memories                       <- NEW
  Instructions                   <- NEW
Manage
  Skills
  Agents
System
  Store
  Plugins
  Settings
```

---

## Feature 1: Memories

### What it scans

| Tool | Paths | Scope | Notes |
|------|-------|-------|-------|
| Codex | `~/.codex/memories/MEMORY.md`, `~/.codex/memories/memory_summary.md`, `~/.codex/memories/raw_memories.md` | global | Large (128KB+) — preview reads first 4KB only |
| Claude Code | `~/.claude/projects/*/memory/*.md` | global | Per-project dirs use content-hashed names — scanned flat as global, NOT correlated to `projectDirs` |
| Windsurf | `~/.codeium/windsurf/memories/*` | global | Per-workspace, auto-generated |
| Cline | `<projectRoot>/memory-bank/*.md` (projectbrief, productContext, activeContext, systemPatterns, techContext, progress) | project | User-maintained, structured like memory |
| Gemini CLI | `~/.gemini/tmp/*/chats/*` | global | Session transcripts, read-only view (no PUT) |

> Cline also ships a Windows global `~/Documents/Cline/Rules/*.md` — that goes under **Instructions**; `./memory-bank` stays under **Memories**.

### Data Model

```typescript
interface MemoryFile {
  id: string;              // "{toolId}::{relativePath}" or "{toolId}::project::{projectId}::{relPath}"
  toolId: string;
  toolName: string;
  name: string;            // filename
  path: string;            // absolute
  scope: "global" | "project";
  projectId?: string;      // present when scope === "project"
  projectName?: string;    // present when scope === "project"
  projectRoot?: string;    // present when scope === "project"
  size: number;
  lastModified: string;    // ISO
  preview?: string;        // first ~200 chars for list view
  readOnly?: boolean;      // true for Gemini session transcripts
}
```

### Backend

**New file: `packages/backend/src/services/memory-scanner.ts`**

- Reuse `expandHome` from `scanner.ts` (import, do not re-implement).
- `MEMORY_SOURCES` array: `{ toolId, toolName, paths: string[], scope: "global" | "project", readOnly?: boolean }`.
- `discoverProjects(projectDirs: string[]): Promise<ProjectRoot[]>` — shared helper.
- `scanMemories(projectDirs: string[]): Promise<MemoryFile[]>` — discovers all files, applies caps.
- `readMemoryContent(filePath: string): Promise<string>` — reads content (with path validation, see Security).
- `writeMemoryContent(filePath: string, content: string): Promise<void>` — saves edits (refused for `readOnly` files).
- For Codex large-file previews: open file, read first 4KB via `fs.createReadStream` with `start:0, end:4095`.

**New file: `packages/backend/src/routes/memories.ts`**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/memories?tool=claude-code&scope=global` | List all memory files (reads from config's `projectDirs`) |
| `GET` | `/api/memories/content?path=/abs/path` | Read file content |
| `PUT` | `/api/memories/content` | Body `{ path, content }` — save (refuses `readOnly`) |

### Frontend

**`packages/frontend/src/components/memories/MemoriesPage.tsx`**

- List of memory cards: tool icon, filename, path, scope badge, project name (if scoped), size, last modified.
- Filter by tool, scope, project.
- "Re-scan" button (invalidates `["memories"]` query).
- Click → navigate to editor.

**`packages/frontend/src/components/memories/MemoryDetailPage.tsx`**

- Metadata: tool, scope, path, project (if scoped), size, last modified.
- `<textarea>` editor with monospace font.
- Save button (hidden/disabled for `readOnly` files).

---

## Feature 2: Instructions

### What it scans

| Tool | Paths | Scope |
|------|-------|-------|
| Claude Code | `~/.claude/CLAUDE.md`, `~/.claude/rules/*.md` | global |
| Claude Code | `./CLAUDE.md`, `./CLAUDE.local.md`, `./.claude/CLAUDE.md`, `./.claude/rules/*.md` | project |
| Cursor | `./.cursorrules`, `./.cursor/rules/*.md` | project |
| Cursor | `~/.cursor/projects/*/rules/*.md` | project (home) | Central per-project rules; folder name encodes the project path (`:` dropped, `\`/`~` → `-`, lowercased). Matched to configured projects encode-first; unmatched folders shown as project-scoped with a best-effort decoded name (`projectId: "home::<encoded>"`). |
| Copilot | `~/.github/copilot-instructions.md` | global |
| Copilot | `./.github/copilot-instructions.md`, `./.github/instructions/*.instructions.md` | project |
| Windsurf | `./.windsurfrules`, `./.windsurf/rules/*.md`, `./.devin/rules/*.md` | project |
| Cline | `~/Documents/Cline/Rules/*.md` | global |
| Cline | `./.clinerules` | project |
| Aider | `./CONVENTIONS.md` | project |
| Gemini CLI | `~/.gemini/GEMINI.md` | global |
| Gemini CLI | `./GEMINI.md` | project |
| Amazon Q | `~/.aws/q/rules/*.md` | global |
| Amazon Q | `./.amazonq/rules/*.md` | project |
| JetBrains Junie | `./.junie/guidelines.md` | project |
| Augment | `./.augment/rules/*.md` | project |
| AGENTS.md | `~/.agents/AGENTS.md` | global |
| AGENTS.md | `./AGENTS.md` | project |

> **Windows note:** Verify each tool's Windows location rather than assuming Unix layouts — Codex, Windsurf, Amazon Q especially. `expandHome` handles `~` → `C:\Users\<user>`; `~/Documents/...` lands in the OS Documents folder.

### Data Model

```typescript
interface InstructionFile {
  id: string;              // "{toolId}::{relativePath}" or "{toolId}::project::{projectId}::{relPath}"
  toolId: string;
  toolName: string;
  name: string;
  path: string;            // absolute
  scope: "global" | "project";
  projectId?: string;      // present when scope === "project"
  projectName?: string;    // present when scope === "project"
  projectRoot?: string;    // present when scope === "project"
  size: number;
  lastModified: string;
  preview?: string;        // first ~200 chars
  hasFrontmatter: boolean; // YAML frontmatter detected
  readOnly?: boolean;      // reserved (currently all instructions are writable)
}
```

### Backend

**New file: `packages/backend/src/services/instruction-scanner.ts`**

- Reuse `expandHome` from `scanner.ts` (import, do not re-implement).
- `INSTRUCTION_SOURCES` array: `{ toolId, toolName, paths: string[], scope: "global" | "project" }`.
- `discoverProjects(projectDirs: string[])` — shared with memory-scanner; factor into `services/projects.ts`.
- `scanInstructions(projectDirs: string[]): Promise<InstructionFile[]>` — discovers all files, applies caps.
- `readInstructionContent(filePath: string): Promise<string>` — reads content (with path validation).
- `writeInstructionContent(filePath: string, content: string): Promise<void>` — saves edits.
- `hasFrontmatter` detection: check first chars for `---\n`.

**New file: `packages/backend/src/routes/instructions.ts`**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/instructions?tool=cursor&scope=project` | List all instruction files (uses config's `projectDirs`) |
| `GET` | `/api/instructions/content?path=/abs/path` | Read content |
| `PUT` | `/api/instructions/content` | Body `{ path, content }` — save |

---

## Security: Path Validation (NEW)

`GET/PUT /content` accept arbitrary absolute paths. Both scanners must validate the resolved absolute path is **within the union of configured source roots** for that feature, and reject otherwise. This is the most important addition versus today's read-only scanner.

### Implementation

- Each scanner maintains a function `getAllowedRoots(): Promise<string[]>` returning absolute paths for:
  - All global source paths (each `MEMORY_SOURCES` / `INSTRUCTION_SOURCES` entry, expanded via `expandHome`).
  - All effective project roots discovered from `projectDirs` (each child dir absolute path).
- `validatePath(filePath: string, allowedRoots: string[]): boolean` — uses `path.resolve` + checks the resolved path starts with one of the allowed roots (with OS-correct separator handling; verify trailing separator to prevent `/root-evil` bypassing `/root`).
- On `readMemoryContent` / `writeMemoryContent` / `readInstructionContent` / `writeInstructionContent`: call `validatePath`; throw `Error("Path outside allowed roots")` returning HTTP 403 from the route.
- Route handlers catch and map: bad path → 403; missing file → 404; other → 500.

---

## Shared / Structural Changes

### Backend

**`packages/backend/src/services/projects.ts` (NEW)** — shared project discovery:
- `interface ProjectRoot { id: string; name: string; path: string; }`
- `SKIP_DIRS` constant (`.git`, `node_modules`, etc.).
- `discoverProjects(projectDirs: string[]): Promise<ProjectRoot[]>` — applies depth-1, skips noise dirs, caps at 200.
- Used by both `memory-scanner.ts` and `instruction-scanner.ts`.

**`packages/backend/src/services/plugins.ts` (EDIT)** — add `projectDirs: string[]` to `PluginConfig` interface and `DEFAULT_CONFIG`.

**`packages/backend/src/index.ts` (EDIT)** — register both new route plugins:
```typescript
import memoriesRoutes from "./routes/memories.js";
import instructionsRoutes from "./routes/instructions.js";
// ...
await app.register(memoriesRoutes);
await app.register(instructionsRoutes);
```

**`packages/backend/src/routes/config.ts` (EDIT)** — `PUT /api/config` persists `projectDirs` via the existing merged-saving flow; no new endpoint needed (the field already passes through).

### Frontend Types (`packages/frontend/src/lib/types.ts` — EDIT)

Add `MemoryFile` and `InstructionFile` interfaces (with optional `projectId`/`projectName`/`projectRoot`/`readOnly`, per the data models above).

### Frontend API (`packages/frontend/src/lib/api.ts` — EDIT)

Add 6 methods following the existing `request<T>` pattern:
```typescript
getMemories, getMemoryContent, saveMemoryContent
getInstructions, getInstructionContent, saveInstructionContent
```
- `getMemories(params?: { tool?: string; scope?: string; project?: string })` — builds `URLSearchParams` like existing `getSkills`.

### Frontend Router (`packages/frontend/src/App.tsx` — EDIT)

```typescript
import MemoriesPage from "./components/memories/MemoriesPage";
import MemoryDetailPage from "./components/memories/MemoryDetailPage";
import InstructionsPage from "./components/instructions/InstructionsPage";
import InstructionDetailPage from "./components/instructions/InstructionDetailPage";
// ...
<Route path="/memories" element={<MemoriesPage />} />
<Route path="/memories/:memoryId" element={<MemoryDetailPage />} />
<Route path="/instructions" element={<InstructionsPage />} />
<Route path="/instructions/:instructionId" element={<InstructionDetailPage />} />
```

### Frontend Sidebar (`packages/frontend/src/components/layout/Sidebar.tsx` — EDIT)

Add `Brain` (memories) and `FileText` (instructions) icons from `lucide-react`. Add a new "Context" section between "Overview" and "Manage":
```typescript
{
  label: "Context",
  items: [
    { to: "/memories", icon: Brain, label: "Memories" },
    { to: "/instructions", icon: FileText, label: "Instructions" },
  ],
},
```

### Frontend Settings (`packages/frontend/src/components/settings/SettingsPage.tsx` — EDIT)

Add a "Project directories" section — multi-row path picker bound to `config.projectDirs`. On change, `saveConfig({ projectDirs })` and invalidate the `["memories"]` / `["instructions"]` queries.

---

## File Summary

```
packages/backend/src/
  services/
    projects.ts                  (NEW — shared project discovery)
    memory-scanner.ts            (NEW)
    instruction-scanner.ts       (NEW)
    plugins.ts                   (EDIT — add projectDirs to PluginConfig)
    scanner.ts                   (NO CHANGE — already exports expandHome)
  routes/
    memories.ts                  (NEW)
    instructions.ts              (NEW)
    config.ts                    (NO CHANGE — existing merge flow handles projectDirs)
  index.ts                       (EDIT — register 2 new route plugins + imports)

packages/frontend/src/
  lib/
    types.ts                     (EDIT — add MemoryFile, InstructionFile)
    api.ts                       (EDIT — add 6 methods)
  components/
    memories/
      MemoriesPage.tsx           (NEW)
      MemoryDetailPage.tsx       (NEW)
    instructions/
      InstructionsPage.tsx       (NEW)
      InstructionDetailPage.tsx  (NEW)
    layout/
      Sidebar.tsx                (EDIT — add Context section)
    settings/
      SettingsPage.tsx           (EDIT — add Project directories picker)
  App.tsx                        (EDIT — add 4 routes + 4 imports)
```

**Total: 7 new files, 6 edits.**

---

## Implementation Order

1. Backend: `services/plugins.ts` — add `projectDirs` to `PluginConfig` + `DEFAULT_CONFIG`.
2. Backend: `services/projects.ts` — shared `discoverProjects` + `SKIP_DIRS` + caps.
3. Backend: `services/memory-scanner.ts` + `routes/memories.ts` (with path validation).
4. Backend: `services/instruction-scanner.ts` + `routes/instructions.ts` (with path validation).
5. Backend: register routes in `index.ts` (add imports + `app.register`).
6. Frontend: types (`types.ts`) + API client (`api.ts` — 6 methods).
7. Frontend: `MemoriesPage` + `MemoryDetailPage` (with Re-scan button).
8. Frontend: `InstructionsPage` + `InstructionDetailPage` (with Re-scan button).
9. Frontend: `SettingsPage` — "Project directories" picker wired to config.
10. Frontend: `Sidebar.tsx` (Context section) + `App.tsx` (4 routes).
11. Typecheck both packages:
    ```bash
    cd packages/frontend && npm run typecheck
    cd packages/backend && npm run typecheck
    ```

---

## Open Items

- **Q4 confirmation**: Cline `~/Documents/Cline/Rules/*.md` lives under Instructions; `./memory-bank/*.md` lives under Memories. Plan assumes this default — confirm.
- **Windows path verification**: Codex/Windsurf/Amazon Q Windows layouts should be confirmed against the actual tools before shipping (the path table above is the best-known Unix convention).