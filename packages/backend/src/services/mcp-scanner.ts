import { readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { parse as parseToml } from "smol-toml";
import { expandHome } from "./scanner.js";
import { discoverProjects, type ProjectRoot } from "./projects.js";
import { loadConfig } from "./plugins.js";

export interface McpServer {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  scope: "global" | "project";
  projectId?: string;
  projectName?: string;
  projectRoot?: string;
  sourceFile: string;
  transport: "stdio" | "http" | "sse" | "unknown";
  command?: string;
  args?: string[];
  url?: string;
  type?: string;
  enabled?: boolean;
  raw: Record<string, unknown>;
}

type FileFormat = "json" | "jsonc" | "toml";

interface McpSource {
  agentId: string;
  agentName: string;
  paths: string[];
  format: FileFormat;
  keyPath: string[];
  scope: "global" | "project";
}

function vscodeUserSettingsPaths(): string[] {
  if (process.platform === "win32") {
    return ["~/AppData/Roaming/Code/User/settings.json"];
  }
  if (process.platform === "darwin") {
    return ["~/Library/Application Support/Code/User/settings.json"];
  }
  return ["~/.config/Code/User/settings.json"];
}

const VSCODE_SETTINGS = vscodeUserSettingsPaths();

const MCP_SOURCES: McpSource[] = [
  {
    agentId: "claude-code",
    agentName: "Claude Code",
    paths: ["~/.claude.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "global",
  },
  {
    agentId: "claude-code",
    agentName: "Claude Code",
    paths: [".mcp.json", ".claude/settings.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "project",
  },
  {
    agentId: "opencode",
    agentName: "OpenCode",
    paths: [
      "~/.config/opencode/opencode.json",
      "~/.config/opencode/opencode.jsonc",
      "~/.opencode/opencode.json",
      "~/.opencode/opencode.jsonc",
    ],
    format: "jsonc",
    keyPath: ["mcp"],
    scope: "global",
  },
  {
    agentId: "opencode",
    agentName: "OpenCode",
    paths: [".opencode/opencode.json", ".opencode/opencode.jsonc"],
    format: "jsonc",
    keyPath: ["mcp"],
    scope: "project",
  },
  {
    agentId: "cursor",
    agentName: "Cursor",
    paths: ["~/.cursor/mcp.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "global",
  },
  {
    agentId: "cursor",
    agentName: "Cursor",
    paths: [".cursor/mcp.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "project",
  },
  {
    agentId: "codex",
    agentName: "Codex",
    paths: ["~/.codex/config.toml"],
    format: "toml",
    keyPath: ["mcp_servers"],
    scope: "global",
  },
  {
    agentId: "codex",
    agentName: "Codex",
    paths: [".codex/config.toml"],
    format: "toml",
    keyPath: ["mcp_servers"],
    scope: "project",
  },
  {
    agentId: "gemini-cli",
    agentName: "Gemini CLI",
    paths: ["~/.gemini/settings.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "global",
  },
  {
    agentId: "gemini-cli",
    agentName: "Gemini CLI",
    paths: [".gemini/settings.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "project",
  },
  {
    agentId: "cline",
    agentName: "Cline",
    paths: ["~/.cline/cline_mcp_settings.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "global",
  },
  {
    agentId: "cline",
    agentName: "Cline",
    paths: VSCODE_SETTINGS,
    format: "json",
    keyPath: ["cline", "mcpServers"],
    scope: "global",
  },
  {
    agentId: "continue",
    agentName: "Continue",
    paths: ["~/.continue/config.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "global",
  },
  {
    agentId: "windsurf",
    agentName: "Windsurf",
    paths: ["~/.codeium/windsurf/mcp_config.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "global",
  },
  {
    agentId: "windsurf",
    agentName: "Windsurf",
    paths: [".windsurf/mcp_config.json"],
    format: "json",
    keyPath: ["mcpServers"],
    scope: "project",
  },
  {
    agentId: "github-copilot",
    agentName: "GitHub Copilot",
    paths: VSCODE_SETTINGS,
    format: "json",
    keyPath: ["github", "copilot", "chat", "mcpServers"],
    scope: "global",
  },
  {
    agentId: "zed",
    agentName: "Zed",
    paths: ["~/.config/zed/settings.json"],
    format: "json",
    keyPath: ["mcp"],
    scope: "global",
  },
];

const MAX_SERVERS = 500;

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Strips // and /* */ comments and trailing commas while keeping string
// contents (URLs like https://) intact.
function stripJsonc(src: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (inString) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

async function parseConfigFile(
  filePath: string,
  format: FileFormat
): Promise<Record<string, unknown>> {
  const raw = await readFile(filePath, "utf-8");
  if (format === "toml") {
    return parseToml(raw) as unknown as Record<string, unknown>;
  }
  const text = format === "jsonc" ? stripJsonc(raw) : raw;
  return JSON.parse(text) as Record<string, unknown>;
}

function getAtPath(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

function inferTransport(entry: Record<string, unknown>): McpServer["transport"] {
  const type = typeof entry.type === "string" ? entry.type.toLowerCase() : "";
  const url = typeof entry.url === "string" ? entry.url : "";
  if (type === "http" || type === "https" || type === "streamable-http") return "http";
  if (type === "sse" || type === "http-sse") return "sse";
  if (typeof entry.command === "string" || Array.isArray(entry.command)) return "stdio";
  if (url) return "http";
  return "unknown";
}

function extractEntry(
  name: string,
  entry: Record<string, unknown>,
  ctx: {
    agentId: string;
    agentName: string;
    scope: "global" | "project";
    sourceFile: string;
    project?: ProjectRoot;
  }
): McpServer | null {
  const command = typeof entry.command === "string" ? entry.command : undefined;
  const args = Array.isArray(entry.command)
    ? entry.command.filter((a): a is string => typeof a === "string")
    : Array.isArray(entry.args)
      ? entry.args.filter((a): a is string => typeof a === "string")
      : undefined;
  const url = typeof entry.url === "string" ? entry.url : undefined;
  const type = typeof entry.type === "string" ? entry.type : undefined;

  let enabled: boolean | undefined;
  if (typeof entry.disabled === "boolean") enabled = !entry.disabled;
  else if (typeof entry.enabled === "boolean") enabled = entry.enabled;

  return {
    id: [
      ctx.agentId,
      ctx.scope,
      ctx.project?.id,
      basename(ctx.sourceFile),
      name,
    ].filter(Boolean).join("::"),
    name,
    agentId: ctx.agentId,
    agentName: ctx.agentName,
    scope: ctx.scope,
    ...(ctx.project
      ? {
          projectId: ctx.project.id,
          projectName: ctx.project.name,
          projectRoot: ctx.project.path,
        }
      : {}),
    sourceFile: ctx.sourceFile,
    transport: inferTransport(entry),
    command,
    args,
    url,
    type,
    enabled,
    raw: entry,
  };
}

function collectServers(
  serverMap: unknown,
  ctx: {
    agentId: string;
    agentName: string;
    scope: "global" | "project";
    sourceFile: string;
    project?: ProjectRoot;
  },
  out: McpServer[]
): void {
  if (!serverMap || typeof serverMap !== "object") return;

  if (Array.isArray(serverMap)) {
    for (const item of serverMap) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const entry = item as Record<string, unknown>;
      const name = typeof entry.name === "string" ? entry.name : "unnamed";
      const server = extractEntry(name, entry, ctx);
      if (server) out.push(server);
    }
    return;
  }

  for (const [name, value] of Object.entries(serverMap as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const server = extractEntry(name, value as Record<string, unknown>, ctx);
    if (server) out.push(server);
  }
}

async function extractFromFile(
  filePath: string,
  source: McpSource,
  project: ProjectRoot | undefined,
  projects: ProjectRoot[],
  out: McpServer[]
): Promise<void> {
  let root: Record<string, unknown>;
  try {
    root = await parseConfigFile(filePath, source.format);
  } catch {
    return;
  }

  const ctx = {
    agentId: source.agentId,
    agentName: source.agentName,
    scope: source.scope,
    sourceFile: filePath,
    project,
  };

  const servers = getAtPath(root, source.keyPath);
  collectServers(servers, ctx, out);

  // Claude Code keeps per-project mcpServers inside ~/.claude.json under
  // `projects: { "<abs-path>": { mcpServers: {...} } }`.
  if (
    source.agentId === "claude-code" &&
    basename(filePath) === ".claude.json"
  ) {
    const projectsMap = root.projects;
    if (projectsMap && typeof projectsMap === "object" && !Array.isArray(projectsMap)) {
      for (const [projectPath, projConfig] of Object.entries(
        projectsMap as Record<string, unknown>
      )) {
        if (!projConfig || typeof projConfig !== "object" || Array.isArray(projConfig)) continue;
        const projServers = (projConfig as Record<string, unknown>).mcpServers;
        if (!projServers || typeof projServers !== "object") continue;

        const normalized = projectPath.replace(/[\\/]+$/, "").toLowerCase();
        const matched =
          projects.find((p) => p.path.replace(/[\\/]+$/, "").toLowerCase() === normalized) ??
          projects.find(
            (p) =>
              normalized.endsWith(p.path.replace(/[\\/]+$/, "").toLowerCase()) ||
              p.path.replace(/[\\/]+$/, "").toLowerCase().endsWith(normalized)
          );

        const matchedProject: ProjectRoot = matched ?? {
          id: `claude-json::${projectPath}`,
          name: projectPath.split(/[\\/]/).filter(Boolean).pop() ?? projectPath,
          path: projectPath,
        };

        collectServers(
          projServers,
          { ...ctx, scope: "project", project: matchedProject },
          out
        );
      }
    }
  }
}

export async function detectMcpServers(projectDirs: string[] = []): Promise<McpServer[]> {
  const out: McpServer[] = [];
  const projects = await discoverProjects(projectDirs);

  for (const source of MCP_SOURCES) {
    if (source.scope === "global") {
      for (const p of source.paths) {
        const expanded = expandHome(p);
        if (!(await pathExists(expanded))) continue;
        await extractFromFile(expanded, source, undefined, projects, out);
        if (out.length >= MAX_SERVERS) return out;
      }
    } else {
      for (const proj of projects) {
        for (const p of source.paths) {
          const absPath = join(proj.path, p);
          if (!(await pathExists(absPath))) continue;
          await extractFromFile(absPath, source, proj, projects, out);
          if (out.length >= MAX_SERVERS) return out;
        }
      }
    }
  }

  return out;
}

export async function getMcpServersWithConfig(): Promise<McpServer[]> {
  const config = await loadConfig();
  return detectMcpServers(config.projectDirs || []);
}
