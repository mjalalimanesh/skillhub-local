import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { delimiter, extname, join } from "node:path";

export interface CLIResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export type CLIProgressCallback = (data: string) => void;

const isWin32 = platform() === "win32";

const PINNED_VERSION = process.env.SKILLHUB_SKILLS_VERSION || "";

function findOnPath(name: string): string | null {
  const pathVar = process.env.PATH || "";
  const extensions = isWin32
    // npm installs an extensionless POSIX shim beside the Windows batch shim.
    ? [".exe", ".cmd", ".bat", ""]
    : [""];
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = join(dir, `${name}${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

let resolvedCommand: string[] | null = null;

function resolveSkillsCommand(): string[] {
  if (resolvedCommand) return resolvedCommand;

  const npx = isWin32 ? findOnPath("npx") || "npx.cmd" : "npx";
  if (PINNED_VERSION) {
    resolvedCommand = [npx, `skills@${PINNED_VERSION}`];
    return resolvedCommand;
  }

  const local = findOnPath("skills");
  if (local) {
    resolvedCommand = [local];
    return resolvedCommand;
  }

  resolvedCommand = [npx, "skills"];
  return resolvedCommand;
}

// Batch shims need cmd.exe, but Node's shell:true joins unquoted arguments.
// Quote every token and reject expansion/metacharacters rather than allow cmd
// (or the shim's second parsing pass) to reinterpret user input as shell syntax.
function quoteBatchArgument(value: string): string {
  if (/[\x00-\x1f\x7f"&|<>^%!]/.test(value)) {
    throw new Error("Unsafe character in Windows skills CLI argument");
  }
  // npm/skills shims forward these arguments to Node's Windows argv parser.
  return `"${value.replace(/\\+$/, "$&$&")}"`;
}

export function runSkillsCLI(
  args: string[],
  onProgress?: CLIProgressCallback,
  // Omitted for existing callers; Harness installs use a temporary project cwd.
  cwd?: string,
  env?: NodeJS.ProcessEnv
): Promise<CLIResult> {
  return new Promise((resolve, reject) => {
    const [cmd, ...cmdArgs] = resolveSkillsCommand();
    const cliArgs = [...cmdArgs, ...args];
    const batchShim = isWin32 && /\.(cmd|bat)$/i.test(extname(cmd));
    const commandLine = batchShim ? [cmd, ...cliArgs].map(quoteBatchArgument).join(" ") : "";
    const proc: ChildProcess = spawn(
      batchShim ? process.env.ComSpec || "cmd.exe" : cmd,
      batchShim ? ["/d", "/s", "/v:off", "/c", `"${commandLine}"`] : cliArgs,
      {
        shell: false,
        windowsVerbatimArguments: batchShim,
        cwd,
        env: {
          ...process.env,
          ...env,
          DISABLE_TELEMETRY: "1",
        },
      }
    );

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
  return !source.startsWith("-") && /^[a-zA-Z0-9._\-\/]+$/.test(source);
}

export function validateSkillName(name: string): boolean {
  return name.trim().length > 0 && !name.trimStart().startsWith("-") && /^[a-zA-Z0-9._ \-]+$/.test(name);
}
