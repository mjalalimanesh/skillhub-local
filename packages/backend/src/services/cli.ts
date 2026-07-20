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

export function validateSource(source: string): boolean {
  return /^[a-zA-Z0-9._\-\/]+$/.test(source);
}

export function validateSkillName(name: string): boolean {
  return /^[a-zA-Z0-9._ \-]+$/.test(name);
}
