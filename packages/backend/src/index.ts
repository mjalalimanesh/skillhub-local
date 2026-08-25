#!/usr/bin/env node
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAuthToken } from "./services/auth.js";
import { stopRunningServer, writePidFile, removePidFile } from "./services/lifecycle.js";
import { loadConfig } from "./services/plugins.js";
import { reconcileTrustedDirs } from "./services/trusted-dirs.js";
import agentRoutes from "./routes/agents.js";
import skillRoutes from "./routes/skills.js";
import projectRoutes from "./routes/projects.js";
import configRoutes from "./routes/config.js";
import healthRoutes from "./routes/health.js";
import memoriesRoutes from "./routes/memories.js";
import instructionsRoutes from "./routes/instructions.js";
import templatesRoutes from "./routes/templates.js";
import browseRoutes from "./routes/browse.js";
import authRoutes from "./routes/auth.js";
import mcpRoutes from "./routes/mcp.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3742;
const HOST = process.env.HOST || "127.0.0.1";

// Host pinning (anti-DNS-rebinding): browsers always send the true Host
// header, so a rebound request — attacker-domain resolving to 127.0.0.1 —
// arrives with a foreign hostname and is rejected before any route runs.
// Non-browser clients can spoof Host freely; they are gated by the token.
function hostnameOfHostHeader(hostHeader: string): string {
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  const colon = host.lastIndexOf(":");
  return colon === -1 ? host : host.slice(0, colon);
}

const LOOPBACK_BINDS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const ALLOWED_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const hostPinningEnabled = LOOPBACK_BINDS.has(HOST.trim().toLowerCase());
const hostAllowed = (hostHeader: string) =>
  ALLOWED_HOSTNAMES.has(hostnameOfHostHeader(hostHeader));

// `skillhub-local stop` — terminate a running instance and exit before any
// startup work happens.
if (process.argv[2] === "stop") {
  const result = await stopRunningServer(PORT);
  console.log(`\n  ${result.message}\n`);
  process.exit(result.ok ? 0 : 1);
}

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

app.addHook("onRequest", async (request, reply) => {
  if (!hostPinningEnabled) return;
  const host = request.headers.host;
  if (typeof host === "string" && hostAllowed(host)) return;
  return reply.code(403).send({ error: "Invalid Host header" });
});

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
await app.register(templatesRoutes);
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
  await writePidFile();
  console.log(`\n  SkillHub Local running at ${address}`);
  if (!hostPinningEnabled) {
    console.log(`  Warning: HOST=${HOST} is not loopback — Host pinning is disabled.`);
  }
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
    console.log("  To stop it: skillhub-local stop (or: npm run stop)");
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
    const hostOk =
      !hostPinningEnabled ||
      (typeof info.req.headers.host === "string" && hostAllowed(info.req.headers.host));
    const url = new URL(info.req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    callback(hostOk && token === authToken);
  },
});

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: "connected", message: "SkillHub WebSocket connected" }));
  ws.on("close", () => wsClients.delete(ws));
  ws.on("error", () => wsClients.delete(ws));
});

// Graceful shutdown: close the WebSocket server and Fastify, clear the PID
// file. Bounded so a stuck connection can't hang the exit forever.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n  Received ${signal} — shutting down.`);
  try {
    for (const client of wsClients) client.terminate();
    wss.close();
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 3000))]);
  } finally {
    removePidFile();
    process.exit(0);
  }
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
