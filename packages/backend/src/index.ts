import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import agentRoutes from "./routes/agents.js";
import skillRoutes from "./routes/skills.js";
import configRoutes from "./routes/config.js";
import healthRoutes from "./routes/health.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3742;
const HOST = process.env.HOST || "127.0.0.1";

const app = Fastify({ logger: true });

const distPath = join(__dirname, "../../frontend/dist");
const isProduction = existsSync(distPath);

await app.register(cors, {
  origin: isProduction
    ? false
    : ["http://localhost:5173", "http://127.0.0.1:5173"],
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
await app.register(configRoutes);
await app.register(healthRoutes);

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
const address = await app.listen({ port: PORT, host: HOST });
console.log(`\n  SkillHub Local running at ${address}\n`);

// WebSocket server
const wss = new WebSocketServer({ server: app.server });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: "connected", message: "SkillHub WebSocket connected" }));
  ws.on("close", () => wsClients.delete(ws));
  ws.on("error", () => wsClients.delete(ws));
});
