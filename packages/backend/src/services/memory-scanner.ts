import { readFile, stat, access, readdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, resolve, normalize, relative, sep } from "node:path";
import { homedir } from "node:os";
import { expandHome } from "./scanner.js";
import { discoverProjects } from "./projects.js";
import { loadConfig } from "./plugins.js";
import { getTrustedDirs } from "./trusted-dirs.js";

export interface MemoryFile {
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
  readOnly?: boolean;
}

interface MemorySource {
  toolId: string;
  toolName: string;
  paths: string[];
  scope: "global" | "project";
  readOnly?: boolean;
}

const MEMORY_SOURCES: MemorySource[] = [
  {
    toolId: "codex",
    toolName: "Codex",
    paths: [
      "~/.codex/memories/MEMORY.md",
      "~/.codex/memories/memory_summary.md",
      "~/.codex/memories/raw_memories.md",
    ],
    scope: "global",
  },
  {
    toolId: "claude-code",
    toolName: "Claude Code",
    paths: ["~/.claude/projects/*/memory/*.md"],
    scope: "global",
  },
  {
    toolId: "windsurf",
    toolName: "Windsurf",
    paths: ["~/.codeium/windsurf/memories/*"],
    scope: "global",
  },
  {
    toolId: "cline",
    toolName: "Cline",
    paths: ["memory-bank/*.md"],
    scope: "project",
  },
  {
    toolId: "gemini-cli",
    toolName: "Gemini CLI",
    paths: ["~/.gemini/tmp/*/chats/*"],
    scope: "global",
    readOnly: true,
  },
];

const MAX_FILES = 5000;

// Claude Code stores memory per working directory under
// ~/.claude/projects/<cwd with non-alphanumerics replaced by "-">/memory/.
function encodeClaudeProjectDir(p: string): string {
  return p.replace(/[^a-zA-Z0-9]/g, "-");
}

function claudeProjectInfo(
  filePath: string,
  projects: { id: string; name: string; path: string }[],
): { projectId: string; projectName: string; projectRoot?: string } | null {
  const marker = `${sep}projects${sep}`;
  const idx = filePath.lastIndexOf(marker);
  if (idx === -1) return null;
  const dirName = filePath.slice(idx + marker.length).split(sep)[0];
  if (!dirName) return null;

  const home = homedir();
  if (dirName === encodeClaudeProjectDir(home)) return null; // user-level cwd: global

  const match = projects.find((p) => encodeClaudeProjectDir(p.path) === dirName);
  if (match) return { projectId: match.id, projectName: match.name, projectRoot: match.path };

  // Unknown project: the encoding is lossy, so show the encoded name minus the home prefix.
  const homePrefix = encodeClaudeProjectDir(home) + "-";
  const display = dirName.startsWith(homePrefix) ? dirName.slice(homePrefix.length) : dirName;
  return { projectId: `claude-code::${dirName}`, projectName: display || dirName };
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
  for (const src of MEMORY_SOURCES) {
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
// global memory paths and directories the user explicitly confirmed via the
// folder picker (never projectDirs from a bare config PUT).
async function getAllowedWriteRoots(): Promise<string[]> {
  const roots: string[] = [];
  for (const src of MEMORY_SOURCES) {
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

export async function scanMemories(projectDirs: string[]): Promise<MemoryFile[]> {
  const results: MemoryFile[] = [];
  const projects = await discoverProjects(projectDirs);

  for (const src of MEMORY_SOURCES) {
    if (src.scope === "global") {
      for (const pattern of src.paths) {
        const files = await expandGlobPattern(pattern);
        for (const filePath of files) {
          try {
            const s = await stat(filePath);
            const preview = await readPreview(filePath, src.readOnly);
            const proj = src.toolId === "claude-code" ? claudeProjectInfo(filePath, projects) : null;
            results.push({
              id: `${src.toolId}::${relative(expandHome("~"), filePath)}`,
              toolId: src.toolId,
              toolName: src.toolName,
              name: filePath.split(/[\\/]/).pop() || filePath,
              path: filePath,
              scope: proj ? "project" : "global",
              ...(proj ?? {}),
              size: s.size,
              lastModified: s.mtime.toISOString(),
              preview,
              readOnly: src.readOnly,
            });
          } catch {
            // skip unreadable files
          }
          if (results.length >= MAX_FILES) return results;
        }
      }
    } else {
      for (const proj of projects) {
        for (const pattern of src.paths) {
          const relPattern = pattern;
          const absPattern = join(proj.path, relPattern);
          const files = await expandGlobPattern(absPattern);
          for (const filePath of files) {
            try {
              const s = await stat(filePath);
              const preview = await readPreview(filePath);
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

  return results;
}

async function readPreview(filePath: string, isLargeFile?: boolean): Promise<string> {
  try {
    if (isLargeFile) {
      const content = await new Promise<string>((res, reject) => {
        const stream = createReadStream(filePath, {
          start: 0,
          end: 4095,
          encoding: "utf-8",
        });
        let data = "";
        stream.on("data", (chunk: string | Buffer) => (data += chunk.toString()));
        stream.on("end", () => res(data));
        stream.on("error", reject);
      });
      return content.slice(0, 200);
    }
    const content = await readFile(filePath, "utf-8");
    return content.slice(0, 200);
  } catch {
    return "";
  }
}

export async function readMemoryContent(filePath: string): Promise<string> {
  const config = await loadConfig();
  const allowedRoots = await getAllowedRoots(config.projectDirs || []);
  if (!validatePath(filePath, allowedRoots)) {
    throw new Error("Path outside allowed roots");
  }
  return readFile(filePath, "utf-8");
}

export async function writeMemoryContent(filePath: string, content: string): Promise<void> {
  const allowedRoots = await getAllowedWriteRoots();
  if (!validatePath(filePath, allowedRoots)) {
    throw new Error("Path outside allowed roots");
  }
  await writeFile(filePath, content, "utf-8");
}
