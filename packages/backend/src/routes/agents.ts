import type { FastifyInstance } from "fastify";
import { relative, resolve, sep } from "node:path";
import {
  detectAgents,
  scanAllSkills,
  readSkillContent,
  listSkillFiles,
  readSkillFile,
  writeSkillFile,
  isUnderKnownSkillDir,
} from "../services/scanner.js";

async function findSkill(agentId: string, skillName: string) {
  const skills = await scanAllSkills(agentId);
  return skills.find((s) => s.name === skillName);
}

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
    const skill = await findSkill(agentId, skillName);
    if (!skill) {
      return reply.code(404).send({ error: "Skill not found" });
    }
    const content = await readSkillContent(skill.path);
    return { skill, content };
  });

  app.get("/api/agents/:agentId/skills/:skillName/files", async (request, reply) => {
    const { agentId, skillName } = request.params as {
      agentId: string;
      skillName: string;
    };
    const skill = await findSkill(agentId, skillName);
    if (!skill) {
      return reply.code(404).send({ error: "Skill not found" });
    }
    const files = await listSkillFiles(skill.path);
    return { files };
  });

  app.get("/api/agents/:agentId/skills/:skillName/files/content", async (request, reply) => {
    const { agentId, skillName } = request.params as {
      agentId: string;
      skillName: string;
    };
    const { path } = request.query as { path?: string };
    if (!path) return reply.code(400).send({ error: "path required" });

    const skill = await findSkill(agentId, skillName);
    if (!skill) {
      return reply.code(404).send({ error: "Skill not found" });
    }

    const resolved = resolve(path);
    const skillRoot = resolve(skill.path);
    if (resolved !== skillRoot && !resolved.startsWith(skillRoot + sep)) {
      return reply.code(403).send({ error: "Path outside skill directory" });
    }

    const files = await listSkillFiles(skill.path);
    const file = files.find((f) => resolve(f.path) === resolved);
    if (!file) {
      return reply.code(404).send({ error: "File not found" });
    }

    if (file.isBinary) {
      return { content: null, isBinary: true };
    }

    try {
      const content = await readSkillFile(resolved);
      return { content, isBinary: false };
    } catch {
      return reply.code(404).send({ error: "File not found" });
    }
  });

  app.put("/api/agents/:agentId/skills/:skillName/files/content", async (request, reply) => {
    const { agentId, skillName } = request.params as {
      agentId: string;
      skillName: string;
    };
    const body = request.body as {
      path?: string;
      content?: string;
      syncToInstances?: boolean;
    };
    if (!body.path || body.content === undefined) {
      return reply.code(400).send({ error: "path and content required" });
    }

    const allSkills = await scanAllSkills();
    const target = allSkills.find((s) => s.agentId === agentId && s.name === skillName);
    if (!target) {
      return reply.code(404).send({ error: "Skill not found" });
    }
    if (target.pluginId) {
      return reply.code(403).send({ error: "Plugin skills are read-only" });
    }
    if (!isUnderKnownSkillDir(target.path)) {
      return reply.code(403).send({ error: "Skill not under a known skill directory" });
    }

    const targetRoot = resolve(target.path);
    const requested = resolve(body.path);
    if (requested !== targetRoot && !requested.startsWith(targetRoot + sep)) {
      return reply.code(403).send({ error: "Path outside skill directory" });
    }
    if (requested === targetRoot) {
      return reply.code(400).send({ error: "Path is not a file" });
    }

    const skillFiles = await listSkillFiles(target.path);
    const targetFile = skillFiles.find((f) => resolve(f.path) === requested);
    if (!targetFile) {
      return reply.code(404).send({ error: "File not found" });
    }
    if (targetFile.isBinary) {
      return reply.code(400).send({ error: "Binary files cannot be edited" });
    }

    const relativePath = relative(targetRoot, requested);

    const syncTargets = body.syncToInstances !== false
      ? allSkills.filter((s) => s.name === skillName && !s.pluginId && isUnderKnownSkillDir(s.path))
      : [target];

    const results: {
      agentId: string;
      success: boolean;
      skipped?: boolean;
      error?: string;
    }[] = [];

    const seen = new Set<string>();
    for (const inst of syncTargets) {
      const instRoot = resolve(inst.path);
      const dest = resolve(instRoot, relativePath);
      if (dest !== instRoot && !dest.startsWith(instRoot + sep)) continue;
      if (seen.has(dest)) continue;
      seen.add(dest);

      try {
        const { access } = await import("node:fs/promises");
        try {
          await access(dest);
        } catch {
          results.push({ agentId: inst.agentId, success: false, skipped: true });
          continue;
        }
        await writeSkillFile(dest, body.content!);
        results.push({ agentId: inst.agentId, success: true });
      } catch (err: any) {
        results.push({ agentId: inst.agentId, success: false, error: err.message });
      }
    }

    return { success: results.every((r) => r.success || r.skipped), results };
  });
}
