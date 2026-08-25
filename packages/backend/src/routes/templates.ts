import type { FastifyInstance } from "fastify";
import {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  TemplateConflictError,
} from "../services/templates.js";

export default async function templatesRoutes(app: FastifyInstance) {
  app.get("/api/templates", async () => {
    const templates = await listTemplates();
    return { templates, total: templates.length };
  });

  app.post("/api/templates/apply", async (request, reply) => {
    const body = request.body as {
      id?: string;
      content?: string;
      targetPath?: string;
      alsoClaude?: boolean;
      force?: boolean;
    };
    if (!body.targetPath) {
      return reply.code(400).send({ error: "targetPath required" });
    }

    let template: { name: string; content: string } | undefined;
    if (body.id) {
      template = await getTemplateById(body.id);
      if (!template) return reply.code(404).send({ error: "Template not found" });
    } else if (body.content !== undefined && body.content.trim().length > 0) {
      template = { name: "Custom", content: body.content };
    } else {
      return reply.code(400).send({ error: "id or content required" });
    }

    try {
      const result = await applyTemplate(template, {
        targetPath: body.targetPath,
        alsoClaude: body.alsoClaude ?? false,
        force: body.force ?? false,
      });
      return { success: true, written: result.written };
    } catch (err: any) {
      if (err instanceof TemplateConflictError) {
        return reply.code(409).send({ error: err.message });
      }
      if (err.message === "Path outside allowed roots" || err.message.startsWith("Path outside allowed roots")) {
        return reply.code(403).send({ error: err.message });
      }
      if (
        err.message === "Target directory does not exist" ||
        err.message === "Target path is not a directory"
      ) {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: "Failed to apply template" });
    }
  });

  app.post("/api/templates", async (request, reply) => {
    const body = request.body as { name?: string; description?: string; content?: string };
    if (!body.name || !body.name.trim()) {
      return reply.code(400).send({ error: "name required" });
    }
    if (body.content === undefined || !body.content.trim()) {
      return reply.code(400).send({ error: "content required" });
    }
    try {
      const template = await createTemplate({
        name: body.name.trim(),
        description: body.description?.trim() || "",
        content: body.content,
      });
      return template;
    } catch (err: any) {
      if (err instanceof TemplateConflictError) {
        return reply.code(409).send({ error: err.message });
      }
      if (err.message === "Invalid template id") {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: "Failed to create template" });
    }
  });

  app.put("/api/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; content?: string };
    if (!body.name || !body.name.trim()) {
      return reply.code(400).send({ error: "name required" });
    }
    if (body.content === undefined || !body.content.trim()) {
      return reply.code(400).send({ error: "content required" });
    }
    try {
      const template = await updateTemplate(id, {
        name: body.name.trim(),
        description: body.description?.trim() || "",
        content: body.content,
      });
      return template;
    } catch (err: any) {
      if (err.message === "Template not found") {
        return reply.code(404).send({ error: err.message });
      }
      if (err.message === "Built-in templates cannot be modified") {
        return reply.code(400).send({ error: err.message });
      }
      if (err.message === "Invalid template id") {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteTemplate(id);
      return { success: true };
    } catch (err: any) {
      if (err.message === "Template not found") {
        return reply.code(404).send({ error: err.message });
      }
      if (err.message === "Built-in templates cannot be deleted") {
        return reply.code(400).send({ error: err.message });
      }
      if (err.message === "Invalid template id") {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: "Failed to delete template" });
    }
  });
}
