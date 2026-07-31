import type { FastifyInstance } from "fastify";
import { getMcpServersWithConfig } from "../services/mcp-scanner.js";
import { listMcpServerTools } from "../services/mcp-client.js";

export default async function mcpRoutes(app: FastifyInstance) {
  app.get("/api/mcp", async (request) => {
    const { agent } = request.query as { agent?: string };
    let servers = await getMcpServersWithConfig();
    if (agent) {
      servers = servers.filter((s) => s.agentId === agent);
    }
    return { servers, total: servers.length };
  });

  app.post("/api/mcp/tools", async (request, reply) => {
    const { id } = request.body as { id?: unknown };
    if (typeof id !== "string" || !id) {
      return reply.code(400).send({ error: "id is required" });
    }
    const servers = await getMcpServersWithConfig();
    const server = servers.find((s) => s.id === id);
    if (!server) {
      return reply.code(404).send({ error: "MCP server not found" });
    }
    return listMcpServerTools(server);
  });
}
