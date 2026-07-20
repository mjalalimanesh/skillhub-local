import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { scanAllSkills, copySkillToAgents } from "../services/scanner.js";
import { runSkillsCLI, validateSource, validateSkillName } from "../services/cli.js";

interface WSProgressEvent {
  type: "install" | "remove" | "update" | "error" | "done";
  skill?: string;
  agent?: string;
  message: string;
  progress?: number;
}

export default async function skillRoutes(app: FastifyInstance) {
  app.get("/api/skills", async (request) => {
    const { agent, scope } = request.query as {
      agent?: string;
      scope?: string;
    };
    let skills = await scanAllSkills(agent);
    if (scope) {
      skills = skills.filter((s) => s.scope === scope);
    }
    return { skills, total: skills.length };
  });

  app.post("/api/skills/install", async (request, reply) => {
    const body = request.body as {
      source: string;
      skill: string;
      agents: string[];
      global?: boolean;
      copy?: boolean;
    };

    if (!body.source || !validateSource(body.source)) {
      return reply.code(400).send({ error: "Invalid source" });
    }
    if (!body.skill || !validateSkillName(body.skill)) {
      return reply.code(400).send({ error: "Invalid skill name" });
    }
    if (!body.agents?.length) {
      return reply.code(400).send({ error: "At least one agent required" });
    }

    const args = ["add", body.source, "--skill", body.skill, "--yes"];
    for (const agent of body.agents) {
      args.push("--agent", agent);
    }
    if (body.global !== false) args.push("--global");
    if (body.copy) args.push("--copy");

    const broadcast = (data: string) => {
      const clients = app.server as any;
      if (clients?.wsClients) {
        for (const client of clients.wsClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        }
      }
    };
    const onProgress = (data: string) => {
      broadcast(JSON.stringify({
        type: "install",
        skill: body.skill,
        message: data,
      } satisfies WSProgressEvent));
    };

    const result = await runSkillsCLI(args, onProgress);

    broadcast(JSON.stringify({
      type: result.exitCode === 0 ? "done" : "error",
      skill: body.skill,
      message: result.exitCode === 0 ? "Install complete" : result.stderr,
      progress: 100,
    } satisfies WSProgressEvent));

    return reply.code(result.exitCode === 0 ? 200 : 500).send(result);
  });

  app.post("/api/skills/remove", async (request, reply) => {
    const body = request.body as {
      skill: string;
      agents: string[];
      global?: boolean;
    };

    if (!body.skill || !validateSkillName(body.skill)) {
      return reply.code(400).send({ error: "Invalid skill name" });
    }
    if (!body.agents?.length) {
      return reply.code(400).send({ error: "At least one agent required" });
    }

    const args = ["remove", "--skill", body.skill, "--yes"];
    for (const agent of body.agents) {
      args.push("--agent", agent);
    }
    if (body.global !== false) args.push("--global");

    const result = await runSkillsCLI(args);
    return reply.code(result.exitCode === 0 ? 200 : 500).send(result);
  });

  app.post("/api/skills/update", async (request, reply) => {
    const body = request.body as {
      skills?: string[];
      global?: boolean;
    };

    const args = ["update", "--yes"];
    if (body.skills?.length) {
      args.push(...body.skills);
    }
    if (body.global !== false) args.push("--global");

    const result = await runSkillsCLI(args);
    return reply.code(result.exitCode === 0 ? 200 : 500).send(result);
  });

  app.post("/api/skills/copy", async (request, reply) => {
    const body = request.body as {
      skillPath: string;
      targetAgents: string[];
      method?: "copy" | "symlink";
    };

    if (!body.skillPath) {
      return reply.code(400).send({ error: "skillPath required" });
    }
    if (!body.targetAgents?.length) {
      return reply.code(400).send({ error: "At least one target agent required" });
    }

    const method = body.method || "copy";
    const results = await copySkillToAgents(body.skillPath, body.targetAgents, method);

    const allSuccess = results.every((r) => r.success);
    return reply.code(allSuccess ? 200 : 207).send({ results });
  });

  app.get("/api/skills/search", async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q) {
      return reply.code(400).send({ error: "Query required" });
    }

    try {
      const res = await fetch(
        `https://skills.sh/api/v1/skills/search?q=${encodeURIComponent(q)}&limit=20`
      );
      const data = await res.json();
      return data;
    } catch (err) {
      return reply.code(502).send({ error: "Failed to search skills.sh" });
    }
  });

  app.get("/api/skills/trending", async () => {
    try {
      const res = await fetch(
        "https://skills.sh/api/v1/skills?sort=trending&limit=20"
      );
      const data = await res.json();
      return data;
    } catch {
      return { skills: [] };
    }
  });

  app.get("/api/skills/curated", async () => {
    try {
      const res = await fetch("https://skills.sh/api/v1/skills/curated");
      const data = await res.json();
      return data;
    } catch {
      return { skills: [] };
    }
  });
}
