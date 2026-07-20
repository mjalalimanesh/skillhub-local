import type { FastifyInstance } from "fastify";
import {
  loadConfig,
  saveConfig,
  addPlugin,
  removePlugin,
  updatePreferences,
} from "../services/plugins.js";

export default async function configRoutes(app: FastifyInstance) {
  app.get("/api/config", async () => {
    return loadConfig();
  });

  app.put("/api/config", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const config = await loadConfig();
    const merged = { ...config, ...body };
    await saveConfig(merged);
    return merged;
  });

  app.post("/api/plugins", async (request, reply) => {
    const body = request.body as {
      type: string;
      name: string;
      [key: string]: unknown;
    };
    if (!body.type || !body.name) {
      return reply.code(400).send({ error: "type and name required" });
    }
    return addPlugin(body as any);
  });

  app.delete("/api/plugins/:type/:name", async (request) => {
    const { type, name } = request.params as { type: string; name: string };
    return removePlugin(type, name);
  });

  app.put("/api/preferences", async (request) => {
    const body = request.body as Record<string, unknown>;
    return updatePreferences(body as any);
  });
}
