import type { FastifyInstance } from "fastify";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { execFile } from "node:child_process";

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return resolve(p);
}

// How long a native picker dialog may stay open before the backend kills it
// and frees the single-flight slot.
const PICK_TIMEOUT_MS = 3 * 60 * 1000;

type ExecResult = { stdout: string; stderr: string };
type ExecError = Error & { code?: string | number | null; stderr?: string };

function execFileWithTimeout(file: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = execFile(file, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        const e = new Error(err.message) as ExecError;
        e.code = err.code;
        e.stderr = stderr;
        reject(e);
      } else {
        resolve({ stdout, stderr });
      }
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("picker timeout"));
    }, PICK_TIMEOUT_MS);
  });
}

function isCancelled(err: ExecError): boolean {
  return /canceled|cancelled/i.test(`${err.message} ${err.stderr ?? ""}`);
}

async function openNativeFolderPicker(): Promise<string> {
  const os = platform();

  if (os === "darwin") {
    try {
      const { stdout } = await execFileWithTimeout("osascript", [
        "-e",
        `POSIX path of (choose folder)`,
      ]);
      const path = stdout.trim().replace(/\/$/, "");
      if (!path) throw new Error("cancelled");
      return path;
    } catch (err: any) {
      if (isCancelled(err)) throw new Error("cancelled");
      throw err;
    }
  }

  if (os === "win32") {
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms | Out-Null
      Add-Type -AssemblyName System.Drawing | Out-Null
      # Tiny always-on-top owner form: shown + activated so the dialog is
      # allowed to take foreground focus even under Windows' foreground lock.
      $owner = New-Object System.Windows.Forms.Form
      $owner.TopMost = $true
      $owner.ShowInTaskbar = $false
      $owner.StartPosition = "Manual"
      $owner.Location = New-Object System.Drawing.Point(-32000, -32000)
      $owner.Size = New-Object System.Drawing.Size(1, 1)
      $owner.Add_Shown({ $owner.Activate() })
      $owner.Show()
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = "Select a project directory"
      $dialog.ShowNewFolderButton = $true
      $result = $dialog.ShowDialog($owner)
      $owner.Close()
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        $dialog.SelectedPath
      }
    `;
    try {
      const { stdout } = await execFileWithTimeout("powershell.exe", [
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        ps,
      ]);
      const path = stdout.trim();
      if (!path) throw new Error("cancelled");
      return path;
    } catch (err: any) {
      if (isCancelled(err)) throw new Error("cancelled");
      const detail = err.stderr?.trim() || err.message;
      throw new Error(detail);
    }
  }

  // Linux: try zenity (GNOME/GTK), then kdialog (KDE)
  try {
    const { stdout } = await execFileWithTimeout("zenity", [
      "--file-selection",
      "--directory",
    ]);
    const path = stdout.trim();
    if (!path) throw new Error("cancelled");
    return path;
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      if (isCancelled(err)) throw new Error("cancelled");
      throw err;
    }
    try {
      const { stdout } = await execFileWithTimeout("kdialog", [
        "--getexistingdirectory",
      ]);
      const path = stdout.trim();
      if (!path) throw new Error("cancelled");
      return path;
    } catch (err2: any) {
      if (err2?.code === "ENOENT") {
        throw new Error("No folder picker available. Install zenity or kdialog.");
      }
      if (isCancelled(err2)) throw new Error("cancelled");
      throw err2;
    }
  }
}

// Only one native picker may exist at a time. Without this, repeated clicks
// stack invisible modal dialogs (Windows foreground lock keeps background-
// spawned dialogs behind the browser) and every spinner hangs forever.
let pickInFlight = false;

export default async function browseRoutes(app: FastifyInstance) {
  app.get("/api/browse", async (request, reply) => {
    const { path: rawPath } = request.query as { path?: string };

    if (!rawPath) {
      return reply.code(400).send({ error: "path query parameter required" });
    }

    const target = expandHome(rawPath);

    try {
      const entries = await readdir(target, { withFileTypes: true });
      const directories: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          directories.push(entry.name);
        }
      }

      directories.sort((a, b) => a.localeCompare(b));

      return {
        path: target,
        parent: join(target, ".."),
        directories,
      };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return reply.code(404).send({ error: "Directory not found" });
      }
      if (err.code === "EACCES") {
        return reply.code(403).send({ error: "Permission denied" });
      }
      return reply.code(500).send({ error: "Failed to read directory" });
    }
  });

  app.get("/api/browse/pick", async (_request, reply) => {
    if (pickInFlight) {
      return reply.code(409).send({
        error: "picker already open",
        detail:
          "A folder picker dialog is already waiting. Choose a folder or cancel it first.",
      });
    }

    pickInFlight = true;
    try {
      const path = await openNativeFolderPicker();
      return { path };
    } catch (err: any) {
      if (err.message === "picker timeout") {
        return reply.code(504).send({
          error: "Folder picker timed out",
          detail: "The dialog stayed open too long and was closed automatically.",
        });
      }
      if (err.message?.includes("cancelled")) {
        return reply.code(499).send({ error: "cancelled" });
      }
      return reply.code(500).send({
        error: "Failed to open folder picker",
        detail: err.message?.slice(0, 500),
      });
    } finally {
      pickInFlight = false;
    }
  });
}
