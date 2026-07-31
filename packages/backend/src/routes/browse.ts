import type { FastifyInstance } from "fastify";
import { readdir, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { homedir } from "node:os";

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return resolve(p);
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
}
