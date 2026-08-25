import type { FastifyInstance } from "fastify";
import { loadConfig } from "../services/plugins.js";
import { discoverProjects } from "../services/projects.js";

export default async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", async () => {
    const config = await loadConfig();
    const projects = await discoverProjects(config.projectDirs || []);
    return { projects, total: projects.length };
  });
}
