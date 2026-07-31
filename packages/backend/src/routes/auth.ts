import type { FastifyInstance } from "fastify";
import { getAuthToken } from "../services/auth.js";

export default async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/token", async () => ({ token: await getAuthToken() }));
}
