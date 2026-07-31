import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { expandHome } from "./scanner.js";

export interface ProjectRoot {
  id: string;
  name: string;
  path: string;
}

const SKIP_DIRS = new Set([
  ".git", ".svn", "node_modules", "dist", "build", "out",
  ".next", ".cache", ".turbo", "target", "venv", ".venv",
  "__pycache__", ".idea", ".vscode",
]);

const MAX_PROJECTS = 200;

export async function discoverProjects(projectDirs: string[]): Promise<ProjectRoot[]> {
  const projects: ProjectRoot[] = [];

  for (const rawDir of projectDirs) {
    const dir = expandHome(rawDir);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;

        const childPath = join(dir, entry.name);
        try {
          const s = await stat(childPath);
          if (!s.isDirectory()) continue;
        } catch {
          continue;
        }

        const projectId = hashString(childPath);
        projects.push({
          id: projectId,
          name: entry.name,
          path: childPath,
        });

        if (projects.length >= MAX_PROJECTS) return projects;
      }
    } catch {
      // directory doesn't exist or can't be read
    }
  }

  return projects;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
