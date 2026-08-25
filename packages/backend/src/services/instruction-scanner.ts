import { readFile, stat, access, readdir, writeFile } from "node:fs/promises";
import { join, resolve, normalize, relative } from "node:path";
import { expandHome } from "./scanner.js";
import { discoverProjects } from "./projects.js";
import type { ProjectRoot } from "./projects.js";
import { loadConfig } from "./plugins.js";
import { getTrustedDirs } from "./trusted-dirs.js";

export interface InstructionFile {
  id: string;
  toolId: string;
  toolName: string;
  name: string;
  path: string;
  scope: "global" | "project";
  projectId?: string;
  projectName?: string;
  projectRoot?: string;
  size: number;
  lastModified: string;
  preview?: string;
  hasFrontmatter: boolean;
  readOnly?: boolean;
}

interface InstructionSource {
  toolId: string;
  toolName: string;
  paths: string[];
  scope: "global" | "project";
  homeProjects?: boolean;
}

const INSTRUCTION_SOURCES: InstructionSource[] = [
  {
    toolId: "claude-code",
    toolName: "Claude Code",
    paths: ["~/.claude/CLAUDE.md", "~/.claude/rules/*.md"],
    scope: "global",
  },
  {
    toolId: "claude-code",
    toolName: "Claude Code",
    paths: ["CLAUDE.md", "CLAUDE.local.md", ".claude/CLAUDE.md", ".claude/rules/*.md"],
    scope: "project",
  },
  {
    toolId: "cursor",
    toolName: "Cursor",
    paths: [".cursorrules", ".cursor/rules/*.md"],
    scope: "project",
  },
  {
    toolId: "cursor",
    toolName: "Cursor",
    paths: ["~/.cursor/projects/*/rules/*.md"],
    scope: "project",
    homeProjects: true,
  },
  {
    toolId: "copilot",
    toolName: "GitHub Copilot",
    paths: ["~/.github/copilot-instructions.md"],
    scope: "global",
  },
  {
    toolId: "copilot",
    toolName: "GitHub Copilot",
    paths: [".github/copilot-instructions.md", ".github/instructions/*.instructions.md"],
    scope: "project",
  },
  {
    toolId: "windsurf",
    toolName: "Windsurf",
    paths: [".windsurfrules", ".windsurf/rules/*.md", ".devin/rules/*.md"],
    scope: "project",
  },
  {
    toolId: "cline",
    toolName: "Cline",
    paths: ["~/Documents/Cline/Rules/*.md"],
    scope: "global",
  },
  {
    toolId: "cline",
    toolName: "Cline",
    paths: [".clinerules"],
    scope: "project",
  },
  {
    toolId: "aider",
    toolName: "Aider",
    paths: ["CONVENTIONS.md"],
    scope: "project",
  },
  {
    toolId: "gemini-cli",
    toolName: "Gemini CLI",
    paths: ["~/.gemini/GEMINI.md"],
    scope: "global",
  },
  {
    toolId: "gemini-cli",
    toolName: "Gemini CLI",
    paths: ["GEMINI.md"],
    scope: "project",
  },
  {
    toolId: "amazon-q",
    toolName: "Amazon Q",
    paths: ["~/.aws/q/rules/*.md"],
    scope: "global",
  },
  {
    toolId: "amazon-q",
    toolName: "Amazon Q",
    paths: [".amazonq/rules/*.md"],
    scope: "project",
  },
  {
    toolId: "junie",
    toolName: "JetBrains Junie",
    paths: [".junie/guidelines.md"],
    scope: "project",
  },
  {
    toolId: "augment",
    toolName: "Augment",
    paths: [".augment/rules/*.md"],
    scope: "project",
  },
  {
    toolId: "agents-md",
    toolName: "AGENTS.md",
    paths: ["~/.agents/AGENTS.md"],
    scope: "global",
  },
  {
    toolId: "agents-md",
    toolName: "AGENTS.md",
    paths: ["AGENTS.md"],
    scope: "project",
  },
];

const MAX_FILES = 5000;

// Cursor stores per-project rules under ~/.cursor/projects/<encoded-path>/rules/,
// where the folder name encodes the project path: separators collapse to "-",
// drive colons and "~" are dropped, and the result is lowercased
// ("/Users/me/dev/app" -> "-users-me-dev-app", "D:\code\app" -> "d-code-app").
// Encoding is ambiguous to reverse (a "-" may come from a separator or the
// folder name itself), so matching runs encode-first and decoding is
// best-effort, used only for display.
function encodeCursorProjectPath(p: string): string {
  return expandHome(p)
    .replace(/[:~]/g, "")
    .replace(/[\\/]/g, "-")
    .toLowerCase();
}

async function decodeCursorProjectPath(encoded: string): Promise<string> {
  const segments = encoded.split("-").filter(Boolean);

  // POSIX form: the leading dash is the root "/"
  if (encoded.startsWith("-")) {
    return "/" + segments.join("/");
  }

  // Windows form: "<drive>-<rest>", e.g. "d-code-app" -> "D:\code\app"
  const drive = (segments.shift() ?? "").toUpperCase();
  if (!drive) return encoded;
  const rest = segments.join("-");

  const candidates: string[] = [];
  candidates.push(`${drive}:\\${rest}`);
  for (let i = 1; i < segments.length; i++) {
    candidates.push(
      `${drive}:\\${segments.slice(0, i).join("\\")}\\${segments.slice(i).join("-")}`
    );
  }
  candidates.push(`${drive}:\\${segments.join("\\")}`);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return candidates[0];
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function validatePath(filePath: string, allowedRoots: string[]): boolean {
  const resolved = resolve(normalize(filePath));
  return allowedRoots.some((root) => {
    const rr = resolve(normalize(root));
    return resolved.startsWith(rr + "/") || resolved.startsWith(rr + "\\") || resolved === rr;
  });
}

async function getAllowedRoots(projectDirs: string[]): Promise<string[]> {
  const roots: string[] = [];
  for (const src of INSTRUCTION_SOURCES) {
    for (const p of src.paths) {
      if (p.includes("*")) {
        const expanded = expandHome(p.split("*")[0]);
        if (await pathExists(expanded)) {
          roots.push(expanded);
        }
      } else {
        roots.push(expandHome(p));
      }
    }
  }
  const projects = await discoverProjects(projectDirs);
  for (const proj of projects) {
    roots.push(proj.path);
  }
  return roots;
}

// Write access is intentionally narrower than read access: only the fixed
// global instruction paths and directories the user explicitly confirmed via
// the folder picker (never projectDirs from a bare config PUT).
async function getAllowedWriteRoots(): Promise<string[]> {
  const roots: string[] = [];
  for (const src of INSTRUCTION_SOURCES) {
    if (src.scope !== "global") continue;
    for (const p of src.paths) {
      const base = p.split("*")[0];
      const expanded = expandHome(base);
      if (p.includes("*")) {
        if (await pathExists(expanded)) roots.push(expanded);
      } else {
        roots.push(expanded);
      }
    }
  }
  const trusted = await getTrustedDirs();
  roots.push(...trusted);
  const projects = await discoverProjects(trusted);
  for (const proj of projects) {
    roots.push(proj.path);
  }
  return roots;
}

async function expandGlobPattern(pattern: string): Promise<string[]> {
  const starIdx = pattern.indexOf("*");
  if (starIdx === -1) {
    return (await pathExists(expandHome(pattern))) ? [expandHome(pattern)] : [];
  }

  const prefix = expandHome(pattern.slice(0, starIdx));
  const suffix = pattern.slice(starIdx + 1);

  if (!(await pathExists(prefix))) return [];

  const files: string[] = [];
  const entries = await readdir(prefix, { withFileTypes: true });
  const hasMoreStars = suffix.includes("*");

  for (const entry of entries) {
    if (hasMoreStars && !entry.isDirectory()) continue;
    if (!hasMoreStars && entry.isDirectory()) continue;

    const childPath = join(prefix, entry.name);
    if (hasMoreStars) {
      if (suffix.startsWith("/*") || suffix.startsWith("\\")) {
        const subPattern = join(childPath, suffix.slice(1));
        const subFiles = await expandGlobPattern(subPattern);
        files.push(...subFiles);
      } else {
        const subPattern = join(childPath, suffix);
        const subFiles = await expandGlobPattern(subPattern);
        files.push(...subFiles);
      }
    } else {
      if (suffix && !entry.name.endsWith(suffix)) continue;
      files.push(childPath);
    }
  }

  return files;
}

async function detectFrontmatter(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content.startsWith("---\n");
  } catch {
    return false;
  }
}

export async function scanInstructions(projectDirs: string[]): Promise<InstructionFile[]> {
  const results: InstructionFile[] = [];
  const projects = await discoverProjects(projectDirs);

  for (const src of INSTRUCTION_SOURCES) {
    if (src.scope === "global") {
      for (const pattern of src.paths) {
        const files = await expandGlobPattern(pattern);
        for (const filePath of files) {
          try {
            const s = await stat(filePath);
            const preview = await readPreview(filePath);
            const hasFrontmatter = await detectFrontmatter(filePath);
            results.push({
              id: `${src.toolId}::${relative(expandHome("~"), filePath)}`,
              toolId: src.toolId,
              toolName: src.toolName,
              name: filePath.split(/[\\/]/).pop() || filePath,
              path: filePath,
              scope: "global",
              size: s.size,
              lastModified: s.mtime.toISOString(),
              preview,
              hasFrontmatter,
            });
          } catch {
            // skip
          }
          if (results.length >= MAX_FILES) return results;
        }
      }
    } else {
      if (src.homeProjects) {
        const encodedToProject = new Map<string, ProjectRoot>();
        for (const proj of projects) {
          encodedToProject.set(encodeCursorProjectPath(proj.path), proj);
        }

        for (const pattern of src.paths) {
          const files = await expandGlobPattern(pattern);
          for (const filePath of files) {
            try {
              const s = await stat(filePath);
              const preview = await readPreview(filePath);
              const hasFrontmatter = await detectFrontmatter(filePath);
              const segments = filePath.split(/[\\/]/);
              const rulesIdx = segments.lastIndexOf("rules");
              const encodedName = rulesIdx > 0 ? segments[rulesIdx - 1] : "";
              const project = encodedToProject.get(encodedName.toLowerCase());

              if (project) {
                results.push({
                  id: `${src.toolId}::project::${project.id}::${relative(project.path, filePath)}`,
                  toolId: src.toolId,
                  toolName: src.toolName,
                  name: filePath.split(/[\\/]/).pop() || filePath,
                  path: filePath,
                  scope: "project",
                  projectId: project.id,
                  projectName: project.name,
                  projectRoot: project.path,
                  size: s.size,
                  lastModified: s.mtime.toISOString(),
                  preview,
                  hasFrontmatter,
                });
              } else {
                const decoded = await decodeCursorProjectPath(encodedName);
                const relName = rulesIdx > 0 ? segments.slice(rulesIdx).join("/") : filePath;
                results.push({
                  id: `${src.toolId}::project::home::${encodedName}::${relName}`,
                  toolId: src.toolId,
                  toolName: src.toolName,
                  name: filePath.split(/[\\/]/).pop() || filePath,
                  path: filePath,
                  scope: "project",
                  projectId: `home::${encodedName}`,
                  projectName: decoded,
                  size: s.size,
                  lastModified: s.mtime.toISOString(),
                  preview,
                  hasFrontmatter,
                });
              }
            } catch {
              // skip
            }
            if (results.length >= MAX_FILES) return results;
          }
        }
      } else {
        for (const proj of projects) {
          for (const pattern of src.paths) {
            const absPattern = join(proj.path, pattern);
            const files = await expandGlobPattern(absPattern);
            for (const filePath of files) {
              try {
                const s = await stat(filePath);
                const preview = await readPreview(filePath);
                const hasFrontmatter = await detectFrontmatter(filePath);
                results.push({
                  id: `${src.toolId}::project::${proj.id}::${relative(proj.path, filePath)}`,
                  toolId: src.toolId,
                  toolName: src.toolName,
                  name: filePath.split(/[\\/]/).pop() || filePath,
                  path: filePath,
                  scope: "project",
                  projectId: proj.id,
                  projectName: proj.name,
                  projectRoot: proj.path,
                  size: s.size,
                  lastModified: s.mtime.toISOString(),
                  preview,
                  hasFrontmatter,
                });
              } catch {
                // skip
              }
              if (results.length >= MAX_FILES) return results;
            }
          }
        }
      }
    }
  }

  return results;
}

async function readPreview(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content.slice(0, 200);
  } catch {
    return "";
  }
}

export async function readInstructionContent(filePath: string): Promise<string> {
  const config = await loadConfig();
  const allowedRoots = await getAllowedRoots(config.projectDirs || []);
  if (!validatePath(filePath, allowedRoots)) {
    throw new Error("Path outside allowed roots");
  }
  return readFile(filePath, "utf-8");
}

export async function writeInstructionContent(filePath: string, content: string): Promise<void> {
  const allowedRoots = await getAllowedWriteRoots();
  if (!validatePath(filePath, allowedRoots)) {
    throw new Error("Path outside allowed roots");
  }
  await writeFile(filePath, content, "utf-8");
}
