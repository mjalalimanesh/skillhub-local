import type { FastifyInstance } from "fastify";
import { scanInstructions, readInstructionContent, writeInstructionContent } from "../services/instruction-scanner.js";
import { loadConfig } from "../services/plugins.js";

export default async function instructionsRoutes(app: FastifyInstance) {
  app.get("/api/instructions", async (request) => {
    const { tool, scope, project } = request.query as {
      tool?: string;
      scope?: string;
      project?: string;
    };
    const config = await loadConfig();
    let instructions = await scanInstructions(config.projectDirs || []);

    if (tool) instructions = instructions.filter((i) => i.toolId === tool);
    if (scope) instructions = instructions.filter((i) => i.scope === scope);
    if (project) instructions = instructions.filter((i) => i.projectId === project);

    return { instructions, total: instructions.length };
  });

  app.get("/api/instructions/content", async (request, reply) => {
    const { path } = request.query as { path?: string };
    if (!path) return reply.code(400).send({ error: "path required" });

    try {
      const content = await readInstructionContent(path);
      return { content };
    } catch (err: any) {
      if (err.message === "Path outside allowed roots") {
        return reply.code(403).send({ error: "Path outside allowed roots" });
      }
      return reply.code(404).send({ error: "File not found" });
    }
  });

  app.put("/api/instructions/content", async (request, reply) => {
    const body = request.body as { path?: string; content?: string };
    if (!body.path || body.content === undefined) {
      return reply.code(400).send({ error: "path and content required" });
    }

    try {
      await writeInstructionContent(body.path, body.content);
      return { success: true };
    } catch (err: any) {
      if (err.message === "Path outside allowed roots") {
        return reply.code(403).send({ error: "Path outside allowed roots" });
      }
      return reply.code(500).send({ error: "Failed to write file" });
    }
  });
}
