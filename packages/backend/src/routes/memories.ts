import type { FastifyInstance } from "fastify";
import { scanMemories, readMemoryContent, writeMemoryContent } from "../services/memory-scanner.js";
import { loadConfig } from "../services/plugins.js";

export default async function memoriesRoutes(app: FastifyInstance) {
  app.get("/api/memories", async (request) => {
    const { tool, scope, project } = request.query as {
      tool?: string;
      scope?: string;
      project?: string;
    };
    const config = await loadConfig();
    let memories = await scanMemories(config.projectDirs || []);

    if (tool) memories = memories.filter((m) => m.toolId === tool);
    if (scope) memories = memories.filter((m) => m.scope === scope);
    if (project) memories = memories.filter((m) => m.projectId === project);

    return { memories, total: memories.length };
  });

  app.get("/api/memories/content", async (request, reply) => {
    const { path } = request.query as { path?: string };
    if (!path) return reply.code(400).send({ error: "path required" });

    try {
      const content = await readMemoryContent(path);
      return { content };
    } catch (err: any) {
      if (err.message === "Path outside allowed roots") {
        return reply.code(403).send({ error: "Path outside allowed roots" });
      }
      return reply.code(404).send({ error: "File not found" });
    }
  });

  app.put("/api/memories/content", async (request, reply) => {
    const body = request.body as { path?: string; content?: string };
    if (!body.path || body.content === undefined) {
      return reply.code(400).send({ error: "path and content required" });
    }

    try {
      await writeMemoryContent(body.path, body.content);
      return { success: true };
    } catch (err: any) {
      if (err.message === "Path outside allowed roots") {
        return reply.code(403).send({ error: "Path outside allowed roots" });
      }
      return reply.code(500).send({ error: "Failed to write file" });
    }
  });
}
