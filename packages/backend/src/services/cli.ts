import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";

export interface CLIResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export type CLIProgressCallback = (data: string) => void;

const isWin32 = platform() === "win32";

export function runSkillsCLI(
  args: string[],
  onProgress?: CLIProgressCallback
): Promise<CLIResult> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn("npx", ["skills", ...args], {
      shell: isWin32,
      env: {
        ...process.env,
        DISABLE_TELEMETRY: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      onProgress?.(text);
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      onProgress?.(text);
    });

    proc.on("error", reject);

    proc.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

export interface SearchResult {
  id: string;
  name: string;
  source: string;
  slug: string;
  installs: number;
  url: string;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

function parseInstalls(raw: string): number {
  const clean = raw.replace(/,/g, "");
  const match = clean.match(/([\d.]+)\s*([KkMm])?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  return Math.round(num);
}

export async function searchSkillsCLI(
  query: string,
  owner?: string
): Promise<SearchResult[]> {
  const args = ["find", query];
  if (owner) args.push("--owner", owner);

  const result = await runSkillsCLI(args);
  const clean = stripAnsi(result.stdout);

  const results: SearchResult[] = [];
  const lines = clean.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(.+?)@(\S+)\s+([\d,.KkMm]+)\s+installs/);
    if (match) {
      const source = match[1].trim();
      const slug = match[2].trim();
      const installs = parseInstalls(match[3]);
      const url = lines[i + 1]?.replace(/^\s*└\s*/, "").trim() || "";
      const id = `${source}/${slug}`;
      const name = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      results.push({ id, name, source, slug, installs, url });
    }
  }

  return results;
}

export function validateSource(source: string): boolean {
  return /^[a-zA-Z0-9._\-\/]+$/.test(source);
}

export function validateSkillName(name: string): boolean {
  return /^[a-zA-Z0-9._ \-]+$/.test(name);
}
