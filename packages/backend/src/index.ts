#!/usr/bin/env node
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAuthToken } from "./services/auth.js";
import { loadConfig } from "./services/plugins.js";
import { reconcileTrustedDirs } from "./services/trusted-dirs.js";
import agentRoutes from "./routes/agents.js";
import skillRoutes from "./routes/skills.js";
import projectRoutes from "./routes/projects.js";
import configRoutes from "./routes/config.js";
import healthRoutes from "./routes/health.js";
import memoriesRoutes from "./routes/memories.js";
import instructionsRoutes from "./routes/instructions.js";
import browseRoutes from "./routes/browse.js";
import authRoutes from "./routes/auth.js";
import mcpRoutes from "./routes/mcp.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3742;
const HOST = process.env.HOST || "127.0.0.1";

// Shell-specific one-liners for launching on a different port
const altPortCommands = (port: number): string[] =>
  process.platform === "win32"
    ? [
        `$env:PORT=${port}; skillhub-local        # PowerShell`,
        `set PORT=${port} && skillhub-local       # cmd.exe`,
      ]
    : [`PORT=${port} skillhub-local`];

// Request logging is opt-in (SKILLHUB_LOG=1 or a log level like "info").
// Default is silent so the CLI doesn't spam the terminal.
const loggerOption = process.env.SKILLHUB_LOG
  ? { level: process.env.SKILLHUB_LOG === "1" ? "info" : process.env.SKILLHUB_LOG }
  : false;
const app = Fastify({ logger: loggerOption });

const authToken = await getAuthToken();

// Trust all configured project directories so previously saved dirs are
// writable without re-confirming them.
const startupConfig = await loadConfig();
await reconcileTrustedDirs(startupConfig.projectDirs || []);

const distPath = process.env.SKILLHUB_FRONTEND_DIST || join(__dirname, "../../frontend/dist");
const isProduction = existsSync(distPath);

await app.register(cors, {
  origin: isProduction
    ? false
    : ["http://localhost:5173", "http://127.0.0.1:5173"],
});

// Reject any API request without the auth token. A browser on a malicious
// site can reach this server (CORS only blocks reading responses), so the
// token must be sent as a custom header on every API call.
const PUBLIC_ENDPOINTS = new Set(["/api/auth/token", "/api/health"]);
app.addHook("onRequest", async (request, reply) => {
  if (reply.sent) return;
  const path = request.url.split("?")[0];
  if (!path.startsWith("/api/") || PUBLIC_ENDPOINTS.has(path)) return;
  if (request.headers["x-skillhub-token"] === authToken) return;
  return reply.code(401).send({ error: "Unauthorized" });
});

// Store ws broadcast function for routes to use
const wsClients = new Set<WebSocket>();
app.decorate("wsClients", wsClients);

const broadcast = (data: string) => {
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
};
app.decorate("wsBroadcast", broadcast);

// Register routes
await app.register(agentRoutes);
await app.register(skillRoutes);
await app.register(projectRoutes);
await app.register(configRoutes);
await app.register(healthRoutes);
await app.register(memoriesRoutes);
await app.register(instructionsRoutes);
await app.register(browseRoutes);
await app.register(authRoutes);
await app.register(mcpRoutes);

// Serve frontend in production
if (isProduction) {
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: "/",
    wildcard: false,
  });
  app.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not found" });
  });
}

// Start server
try {
  const address = await app.listen({ port: PORT, host: HOST });
  console.log(`\n  SkillHub Local running at ${address}`);
  console.log(`  Access token: ${authToken}\n`);
} catch (err) {
  if ((err as NodeJS.ErrnoException | undefined)?.code !== "EADDRINUSE") throw err;

  // The port is taken. If the thing already answering on it looks like
  // SkillHub itself, a second launch is a no-op — point at it and exit
  // cleanly instead of dumping a stack trace.
  let alreadySkillHub = false;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = (await res.json()) as { status?: string };
    alreadySkillHub = res.ok && body?.status === "ok";
  } catch {
    // Not reachable, or not SkillHub-shaped
  }

  if (alreadySkillHub) {
    console.log(`\n  SkillHub Local is already running at http://127.0.0.1:${PORT}`);
    console.log("  Open the URL above in your browser.");
    console.log("  To run a second instance on another port instead:");
    for (const cmd of altPortCommands(PORT + 1)) console.log(`    ${cmd}`);
    console.log("");
    process.exit(0);
  }

  console.error(`\n  Port ${PORT} is already in use by another program.`);
  console.error("  To start SkillHub Local on a different port:");
  for (const cmd of altPortCommands(PORT + 1)) console.error(`    ${cmd}`);
  console.error("");
  process.exit(1);
}

// WebSocket server — token required in query string since any page can open
// a raw WebSocket to this server regardless of CORS
const wss = new WebSocketServer({
  server: app.server,
  verifyClient: (info, callback) => {
    const url = new URL(info.req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    callback(token === authToken);
  },
});

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: "connected", message: "SkillHub WebSocket connected" }));
  ws.on("close", () => wsClients.delete(ws));
  ws.on("error", () => wsClients.delete(ws));
});
