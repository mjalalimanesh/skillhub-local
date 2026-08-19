import type { FastifyInstance } from "fastify";
import { getMcpServersWithConfig } from "../services/mcp-scanner.js";
import {
  listMcpServerTools,
  startMcpOAuth,
  finishMcpOAuth,
  type McpAuthOverrides,
} from "../services/mcp-client.js";
import {
  getMcpAuthEntry,
  setMcpAuthOverrides,
  clearMcpOAuth,
  hasMcpOAuthTokens,
  getServerIdForOAuthState,
} from "../services/mcp-auth.js";

function stringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

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
    const body = request.body as {
      id?: unknown;
      headers?: unknown;
      env?: unknown;
    };
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return reply.code(400).send({ error: "id is required" });
    }
    const servers = await getMcpServersWithConfig();
    const server = servers.find((s) => s.id === id);
    if (!server) {
      return reply.code(404).send({ error: "MCP server not found" });
    }
    const overrides: McpAuthOverrides = {
      headers: stringMap(body.headers),
      env: stringMap(body.env),
    };
    return listMcpServerTools(server, overrides);
  });

  app.get("/api/mcp/auth/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await getMcpAuthEntry(id);
    const oauth = await hasMcpOAuthTokens(id);
    return {
      headers: entry?.headers ?? {},
      env: entry?.env ?? {},
      oauthAuthorized: oauth,
    };
  });

  app.put("/api/mcp/auth/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { headers?: unknown; env?: unknown };
    const serverId = id;
    const servers = await getMcpServersWithConfig();
    if (!servers.find((s) => s.id === serverId)) {
      return reply.code(404).send({ error: "MCP server not found" });
    }
    const entry = await setMcpAuthOverrides(serverId, {
      headers: stringMap(body.headers),
      env: stringMap(body.env),
    });
    return {
      headers: entry.headers ?? {},
      env: entry.env ?? {},
    };
  });

  app.delete("/api/mcp/auth/:id", async (request) => {
    const { id } = request.params as { id: string };
    const serverId = id;
    await setMcpAuthOverrides(serverId, {});
    await clearMcpOAuth(serverId);
    return { success: true };
  });

  app.post("/api/mcp/oauth/start", async (request, reply) => {
    const { id } = request.body as { id?: unknown };
    if (typeof id !== "string" || !id) {
      return reply.code(400).send({ error: "id is required" });
    }
    const servers = await getMcpServersWithConfig();
    const server = servers.find((s) => s.id === id);
    if (!server) {
      return reply.code(404).send({ error: "MCP server not found" });
    }
    return startMcpOAuth(server);
  });

  app.post("/api/mcp/oauth/status", async (request, reply) => {
    const { id } = request.body as { id?: unknown };
    if (typeof id !== "string" || !id) {
      return reply.code(400).send({ error: "id is required" });
    }
    return { authorized: await hasMcpOAuthTokens(id) };
  });

  app.get("/oauth/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code || !state) {
      return reply
        .code(400)
        .type("text/html")
        .send("<h1>Authorization failed</h1><p>Missing code or state.</p>");
    }
    const serverId = getServerIdForOAuthState(state);
    if (!serverId) {
      return reply
        .code(400)
        .type("text/html")
        .send("<h1>Authorization failed</h1><p>Unknown state.</p>");
    }
    const servers = await getMcpServersWithConfig();
    const server = servers.find((s) => s.id === serverId);
    if (!server) {
      return reply
        .code(404)
        .type("text/html")
        .send("<h1>Authorization failed</h1><p>MCP server not found.</p>");
    }
    const result = await finishMcpOAuth(server, code);
    if (!result.success) {
      return reply
        .code(500)
        .type("text/html")
        .send(
          `<h1>Authorization failed</h1><p>${result.error ?? "Unknown error"}</p>`
        );
    }
    return reply
      .type("text/html")
      .send(
        "<h1>Authorization complete</h1><p>You can close this tab and return to SkillHub.</p>"
      );
  });
}
