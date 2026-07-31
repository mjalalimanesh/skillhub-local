import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

const DIR = join(homedir(), ".skillhub");
const TOKEN_FILE = join(DIR, "token");

let cached: string | null = null;

export async function getAuthToken(): Promise<string> {
  if (cached) return cached;

  try {
    await access(TOKEN_FILE);
    const raw = await readFile(TOKEN_FILE, "utf-8");
    const token = raw.trim();
    if (token) {
      cached = token;
      return cached;
    }
  } catch {
    // no token yet — generate below
  }

  const token = randomBytes(32).toString("hex");
  await mkdir(DIR, { recursive: true });
  await writeFile(TOKEN_FILE, token, { encoding: "utf-8", mode: 0o600 });
  cached = token;
  return cached;
}
