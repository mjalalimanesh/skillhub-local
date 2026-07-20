import type { FastifyInstance } from "fastify";
import { detectAgents, scanAllSkills, readSkillContent } from "../services/scanner.js";

export default async function agentRoutes(app: FastifyInstance) {
  app.get("/api/agents", async () => {
    const agents = await detectAgents();
    return { agents };
  });

  app.get("/api/agents/:id/skills", async (request, reply) => {
    const { id } = request.params as { id: string };
    const agents = await detectAgents();
    const agent = agents.find((a) => a.id === id);
    if (!agent) {
      return reply.code(404).send({ error: "Agent not found" });
    }
    const skills = await scanAllSkills(id);
    return { agent, skills };
  });

  app.get("/api/agents/:agentId/skills/:skillName", async (request, reply) => {
    const { agentId, skillName } = request.params as {
      agentId: string;
      skillName: string;
    };
    const skills = await scanAllSkills(agentId);
    const skill = skills.find((s) => s.name === skillName);
    if (!skill) {
      return reply.code(404).send({ error: "Skill not found" });
    }
    const content = await readSkillContent(skill.path);
    return { skill, content };
  });
}
