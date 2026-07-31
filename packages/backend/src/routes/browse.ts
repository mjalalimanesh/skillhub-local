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
      const script = `
        tell application "Finder"
          set folderPath to POSIX path of (choose folder)
        end tell
        return folderPath
      `;
      execFile("osascript", ["-e", script], (err, stdout) => {
        if (err) return reject(err);
        const path = stdout.trim().replace(/\/$/, "");
        resolve(path);
      });
    } else if (os === "win32") {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Select a project directory"
        $dialog.ShowNewFolderButton = $true
        if ($dialog.ShowDialog() -eq "OK") {
          $dialog.SelectedPath
        } else {
          throw "User cancelled"
        }
      `;
      execFile("powershell.exe", ["-NoProfile", "-Command", ps], (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    } else {
      execFile("zenity", ["--file-selection", "--directory"], (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
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
      return reply.code(500).send({ error: "Failed to open folder picker" });
    }
  });
}
