import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });
}
