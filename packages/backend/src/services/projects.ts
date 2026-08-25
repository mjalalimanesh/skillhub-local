import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { expandHome } from "./paths.js";

export interface ProjectRoot {
  id: string;
  name: string;
  path: string;
}

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", "out", "target", "venv", ".venv",
  "__pycache__", "coverage", "DerivedData", "Pods", "bin", "obj",
  "Debug", "Release", "tmp", "temp",
  "System Volume Information", "Recovery", "Windows",
  "Program Files", "Program Files (x86)", "ProgramData", "PerfLogs",
  "Documents and Settings", "Config.Msi", "MSOCache",
  "Intel", "AMD", "NVIDIA",
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
        if (isSystemFolder(entry.name)) continue;

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

function isSystemFolder(name: string): boolean {
  return (
    name.startsWith(".") ||
    name.startsWith("$") ||
    SKIP_DIRS.has(name)
  );
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
