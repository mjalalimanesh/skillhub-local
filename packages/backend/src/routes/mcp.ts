import type { FastifyInstance } from "fastify";
import { getMcpServersWithConfig } from "../services/mcp-scanner.js";

export default async function mcpRoutes(app: FastifyInstance) {
  app.get("/api/mcp", async (request) => {
    const { agent } = request.query as { agent?: string };
    let servers = await getMcpServersWithConfig();
    if (agent) {
      servers = servers.filter((s) => s.agentId === agent);
    }
    return { servers, total: servers.length };
  });
}
