import { readFile, writeFile, mkdir, access, stat } from "node:fs/promises";
import { join, resolve, normalize } from "node:path";
import { homedir } from "node:os";
import { expandHome } from "./scanner.js";

const DIR = join(homedir(), ".skillhub");
const FILE = join(DIR, "trusted-dirs.json");

function normalizePath(p: string): string {
  return resolve(normalize(expandHome(p)));
}

async function load(): Promise<string[]> {
  try {
    await access(FILE);
    const raw = await readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p) => typeof p === "string").map(normalizePath);
    }
  } catch {
    // not present or corrupt — start empty
  }
  return [];
}

async function save(dirs: string[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify([...new Set(dirs)], null, 2), "utf-8");
}

export async function getTrustedDirs(): Promise<string[]> {
  return load();
}

export async function addTrustedDir(path: string): Promise<string[]> {
  const normalized = normalizePath(path);
  try {
    const s = await stat(normalized);
    if (!s.isDirectory()) {
      throw new Error("Not a directory");
    }
  } catch {
    throw new Error("Directory does not exist");
  }

  const dirs = await load();
  if (!dirs.includes(normalized)) {
    dirs.push(normalized);
    await save(dirs);
  }
  return dirs;
}

export async function removeTrustedDir(path: string): Promise<string[]> {
  const normalized = normalizePath(path);
  const dirs = await load();
  const updated = dirs.filter((d) => d !== normalized);
  if (updated.length !== dirs.length) {
    await save(updated);
  }
  return updated;
}

// Make the trusted list mirror the saved project directories. Entries are
// trusted verbatim (existence is checked when they are used for writes).
export async function reconcileTrustedDirs(projectDirs: string[]): Promise<string[]> {
  const desired = projectDirs
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .map(normalizePath);

  const current = await load();
  const changed =
    desired.length !== current.length ||
    desired.some((d) => !current.includes(d));

  if (!changed) return current;

  await save(desired);
  return desired;
}
