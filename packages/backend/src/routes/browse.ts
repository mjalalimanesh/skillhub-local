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

function openNativeFolderPicker(): Promise<string> {
  return new Promise((resolve, reject) => {
    const os = platform();

    if (os === "darwin") {
      const script = `POSIX path of (choose folder)`;
      execFile("osascript", ["-e", script], (err, stdout) => {
        if (err) return reject(err);
        const path = stdout.trim().replace(/\/$/, "");
        if (!path) return reject(new Error("cancelled"));
        resolve(path);
      });
    } else if (os === "win32") {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms | Out-Null
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Select a project directory"
        $dialog.ShowNewFolderButton = $true
        # Owner form raised to the front so the dialog never opens behind other windows
        $owner = New-Object System.Windows.Forms.Form
        $owner.TopMost = $true
        if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
          $dialog.SelectedPath
        }
      `;
      const psArgs = ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps];
      execFile("powershell.exe", psArgs, (err, stdout, stderr) => {
        if (err) {
          const detail = stderr?.trim() || err.message;
          if (/canceled|cancelled/i.test(detail) && !stdout.trim()) return reject(new Error("cancelled"));
          return reject(new Error(detail));
        }
        const path = stdout.trim();
        if (!path) return reject(new Error("cancelled"));
        resolve(path);
      });
    } else {
      // Try zenity (GNOME/GTK), then kdialog (KDE)
      execFile("zenity", ["--file-selection", "--directory"], (err, stdout) => {
        if (!err && stdout.trim()) {
          return resolve(stdout.trim());
        }
        execFile("kdialog", ["--getexistingdirectory"], (err2, stdout2) => {
          if (!err2 && stdout2.trim()) {
            return resolve(stdout2.trim());
          }
          reject(new Error("No folder picker available. Install zenity or kdialog."));
        });
      });
    }
  });
}

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
    try {
      const path = await openNativeFolderPicker();
      return { path };
    } catch (err: any) {
      if (err.message?.includes("cancelled")) {
        return reply.code(499).send({ error: "cancelled" });
      }
      return reply.code(500).send({
        error: "Failed to open folder picker",
        detail: err.message?.slice(0, 500),
      });
    }
  });
}
