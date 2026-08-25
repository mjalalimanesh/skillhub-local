import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PID_FILE = join(homedir(), ".skillhub", "server.pid");

export interface StopResult {
  ok: boolean;
  message: string;
}

export async function writePidFile(): Promise<void> {
  await writeFile(PID_FILE, String(process.pid), "utf-8");
}

export function removePidFile(): void {
  try {
    rmSync(PID_FILE, { force: true });
  } catch {
    // best effort
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Find PIDs listening on the port, using whatever the platform offers.
function findPortOwners(port: number): number[] {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique`,
        ],
        { timeout: 5000 },
      );
      return out
        .toString()
        .split(/\r?\n/)
        .map((line) => Number(line.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
    }
    const out = execFileSync("sh", ["-c", `lsof -ti tcp:${port} || true`], {
      timeout: 5000,
    });
    return out
      .toString()
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

async function healthOk(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = (await res.json()) as { status?: string };
    return res.ok && body?.status === "ok";
  } catch {
    return false;
  }
}

// Stop a running SkillHub server: prefer the PID file, fall back to killing
// whatever listens on the port — but only if it answers as SkillHub.
export async function stopRunningServer(port: number): Promise<StopResult> {
  const pids = new Set<number>();

  try {
    const raw = (await readFile(PID_FILE, "utf-8")).trim();
    const pid = Number(raw);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid && isAlive(pid)) {
      pids.add(pid);
    }
  } catch {
    // no pid file
  }

  if (pids.size === 0 && (await healthOk(port))) {
    for (const pid of findPortOwners(port)) pids.add(pid);
  }

  if (pids.size === 0) {
    return { ok: true, message: "SkillHub Local is not running." };
  }

  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch {
      // already gone
    }
  }

  // Wait briefly for all targets to actually die before reporting success.
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && [...pids].some(isAlive)) {
    await new Promise((r) => setTimeout(r, 100));
  }

  removePidFile();

  const stuck = [...pids].filter(isAlive);
  if (stuck.length > 0) {
    return {
      ok: false,
      message: `Failed to stop process(es): ${stuck.join(", ")}`,
    };
  }

  return {
    ok: true,
    message: `Stopped SkillHub Local (process${pids.size > 1 ? "es" : ""}: ${[...pids].join(", ")}).`,
  };
}
