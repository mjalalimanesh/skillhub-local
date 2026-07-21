import { readdir, stat, readFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import matter from "gray-matter";
import { detectInstalledPlugins } from "./installed-plugins.js";

interface AgentDef {
  id: string;
  name: string;
  globalDir: string;
  projectDir: string;
  icon: string;
  extraDirs?: string[];
  builtInNote?: string;
}

// Shared global skills directory used by many agents (per skill-lock.json)
const SHARED_GLOBAL_DIR = "~/.agents/skills";

const AGENT_DEFINITIONS: AgentDef[] = [
  { id: "claude-code", name: "Claude Code", globalDir: "~/.claude/skills", projectDir: ".claude/skills", icon: "anthropic", extraDirs: [SHARED_GLOBAL_DIR] },
  { id: "codex", name: "Codex", globalDir: "~/.codex/skills", projectDir: ".agents/skills", icon: "openai", extraDirs: [SHARED_GLOBAL_DIR] },
  { id: "opencode", name: "OpenCode", globalDir: "~/.config/opencode/skills", projectDir: ".agents/skills", icon: "opencode", extraDirs: [SHARED_GLOBAL_DIR, "~/.claude/skills", "~/.opencode/skills"], builtInNote: "Also has embedded skills (e.g. customize-opencode) compiled into the binary" },
  { id: "cursor", name: "Cursor", globalDir: "~/.cursor/skills", projectDir: ".agents/skills", icon: "cursor", extraDirs: ["~/.cursor/skills-cursor", "~/.cursor/plugins/cache/cursor-public", SHARED_GLOBAL_DIR] },
  { id: "gemini-cli", name: "Gemini CLI", globalDir: "~/.gemini/skills", projectDir: ".agents/skills", icon: "gemini", extraDirs: [SHARED_GLOBAL_DIR] },
  { id: "github-copilot", name: "GitHub Copilot", globalDir: "~/.copilot/skills", projectDir: ".agents/skills", icon: "copilot", extraDirs: [SHARED_GLOBAL_DIR] },
  { id: "windsurf", name: "Windsurf", globalDir: "~/.codeium/windsurf/skills", projectDir: ".windsurf/skills", icon: "windsurf" },
  { id: "cline", name: "Cline", globalDir: "~/.agents/skills", projectDir: ".agents/skills", icon: "cline" },
  { id: "amp", name: "Amp", globalDir: "~/.config/agents/skills", projectDir: ".agents/skills", icon: "amp", extraDirs: [SHARED_GLOBAL_DIR] },
  { id: "continue", name: "Continue", globalDir: "~/.continue/skills", projectDir: ".continue/skills", icon: "continue" },
  { id: "roo", name: "Roo Code", globalDir: "~/.roo/skills", projectDir: ".roo/skills", icon: "roo" },
  { id: "goose", name: "Goose", globalDir: "~/.config/goose/skills", projectDir: ".goose/skills", icon: "goose" },
  { id: "antigravity", name: "Antigravity", globalDir: "~/.gemini/antigravity/skills", projectDir: ".agents/skills", icon: "antigravity", extraDirs: [SHARED_GLOBAL_DIR] },
  { id: "hermes-agent", name: "Hermes Agent", globalDir: "~/.hermes/skills", projectDir: ".hermes/skills", icon: "hermes" },
  { id: "zed", name: "Zed", globalDir: "~/.agents/skills", projectDir: ".agents/skills", icon: "zed" },
  { id: "warp", name: "Warp", globalDir: "~/.agents/skills", projectDir: ".agents/skills", icon: "warp" },
];

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    const rest = p.slice(1);
    // Hermes uses %LOCALAPPDATA% on Windows, ~/.hermes on Unix
    if ((rest.startsWith("/.hermes") || rest === "/.hermes") && platform() === "win32") {
      // ~/.hermes/* → ~/AppData/Local/hermes/*
      const hermesRest = rest.replace(/^\/\.hermes/, "/hermes");
      return join(homedir(), "AppData", "Local", hermesRest);
    }
    return join(homedir(), rest);
  }
  return resolve(p);
}

interface SkillEntry {
  name: string;
  path: string;
  description: string;
  frontmatter: Record<string, unknown>;
  hasScripts: boolean;
  hasAssets: boolean;
  hasReferences: boolean;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function scanSkillDir(dir: string, depth = 0): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];
  if (!(await pathExists(dir)) || depth > 5) return skills;

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    // First pass: check if this directory itself is a skill
    const skillMdHere = join(dir, "SKILL.md");
    if (depth > 0 && await pathExists(skillMdHere)) {
      // Don't add — this dir is a parent of nested skills, not a skill itself
    }

    // Second pass: scan children
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const childDir = join(dir, entry.name);
      const skillMdPath = join(childDir, "SKILL.md");

      if (await pathExists(skillMdPath)) {
        // Found a SKILL.md — this is a skill directory
        try {
          const raw = await readFile(skillMdPath, "utf-8");
          const { data: frontmatter, content } = matter(raw);
          const description = (frontmatter.description as string) || content.split("\n").slice(0, 2).join(" ").trim();

          const hasScripts = await pathExists(join(childDir, "scripts"));
          const hasAssets = await pathExists(join(childDir, "assets"));
          const hasReferences = await pathExists(join(childDir, "references"));

          skills.push({
            name: entry.name,
            path: childDir,
            description,
            frontmatter,
            hasScripts,
            hasAssets,
            hasReferences,
          });
        } catch {
          // skip malformed skills
        }
      } else {
        // No SKILL.md — recurse into subdirectory
        // (handles .system/, skills-cursor/, category dirs, etc.)
        const nested = await scanSkillDir(childDir, depth + 1);
        skills.push(...nested);
      }
    }
  } catch {
    // directory read error
  }

  return skills;
}

export interface DetectedAgent {
  id: string;
  name: string;
  configDir: string;
  skillDir: string;
  detected: boolean;
  skillCount: number;
  pluginCount: number;
  icon: string;
  builtInNote?: string;
}

export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  agentId: string;
  scope: "global" | "project";
  path: string;
  frontmatter: Record<string, unknown>;
  hasScripts: boolean;
  hasAssets: boolean;
  hasReferences: boolean;
  pluginId?: string;
  pluginName?: string;
}

export async function detectAgents(): Promise<DetectedAgent[]> {
  const results: DetectedAgent[] = [];
  const allPlugins = await detectInstalledPlugins();

  for (const agent of AGENT_DEFINITIONS) {
    const globalDir = expandHome(agent.globalDir);
    const configDir = expandHome(agent.globalDir.replace("/skills", ""));
    // Agent is detected if either the skills dir or the config dir exists
    const detected = (await pathExists(globalDir)) || (await pathExists(configDir));
    let skillCount = 0;

    if (await pathExists(globalDir)) {
      const skills = await scanSkillDir(globalDir);
      skillCount = skills.length;
    }

    // Also scan extra dirs regardless of main dir existence
    if (agent.extraDirs) {
      for (const extraDir of agent.extraDirs) {
        const extraPath = expandHome(extraDir);
        const extraSkills = await scanSkillDir(extraPath);
        skillCount += extraSkills.length;
      }
    }

    // Count plugins and their skills for this agent
    const agentPlugins = allPlugins.filter((p) => p.agentId === agent.id);
    const pluginSkillCount = agentPlugins.reduce((sum, p) => sum + p.skillCount, 0);
    skillCount += pluginSkillCount;

    results.push({
      id: agent.id,
      name: agent.name,
      configDir,
      skillDir: globalDir,
      detected,
      skillCount,
      pluginCount: agentPlugins.length,
      icon: agent.icon,
      builtInNote: agent.builtInNote,
    });
  }

  return results;
}

export async function scanAllSkills(agentId?: string): Promise<InstalledSkill[]> {
  const allSkills: InstalledSkill[] = [];
  const agents = AGENT_DEFINITIONS.filter((a) => !agentId || a.id === agentId);

  for (const agent of agents) {
    const globalDir = expandHome(agent.globalDir);
    const skills = await scanSkillDir(globalDir);

    for (const skill of skills) {
      allSkills.push({
        id: `${agent.id}::${skill.name}`,
        name: skill.name,
        description: skill.description,
        agentId: agent.id,
        scope: "global",
        path: skill.path,
        frontmatter: skill.frontmatter,
        hasScripts: skill.hasScripts,
        hasAssets: skill.hasAssets,
        hasReferences: skill.hasReferences,
      });
    }

    // Also scan extra dirs
    if (agent.extraDirs) {
      for (const extraDir of agent.extraDirs) {
        const extraPath = expandHome(extraDir);
        const extraSkills = await scanSkillDir(extraPath);
        for (const skill of extraSkills) {
          allSkills.push({
            id: `${agent.id}::${skill.name}`,
            name: skill.name,
            description: skill.description,
            agentId: agent.id,
            scope: "global",
            path: skill.path,
            frontmatter: skill.frontmatter,
            hasScripts: skill.hasScripts,
            hasAssets: skill.hasAssets,
            hasReferences: skill.hasReferences,
          });
        }
      }
    }
  }

  // Merge plugin skills
  const plugins = await detectInstalledPlugins();
  for (const plugin of plugins) {
    if (agentId && plugin.agentId !== agentId) continue;
    for (const skill of plugin.skills) {
      allSkills.push({
        id: `${plugin.agentId}::${plugin.name}:${skill.name}`,
        name: `${plugin.name}:${skill.name}`,
        description: skill.description,
        agentId: plugin.agentId,
        scope: "global",
        path: skill.path,
        frontmatter: skill.frontmatter,
        hasScripts: false,
        hasAssets: false,
        hasReferences: false,
        pluginId: plugin.id,
        pluginName: plugin.name,
      });
    }
  }

  return allSkills;
}

export async function readSkillContent(skillPath: string): Promise<string> {
  const skillMdPath = join(skillPath, "SKILL.md");
  return readFile(skillMdPath, "utf-8");
}

export async function copySkillToAgents(
  skillPath: string,
  targetAgentIds: string[],
  method: "copy" | "symlink" = "copy"
): Promise<{ agent: string; success: boolean; error?: string }[]> {
  const results: { agent: string; success: boolean; error?: string }[] = [];
  const skillName = skillPath.split(/[\\/]/).pop() || "unknown";

  for (const agentId of targetAgentIds) {
    const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId);
    if (!agent) {
      results.push({ agent: agentId, success: false, error: "Agent not found" });
      continue;
    }

    const targetDir = expandHome(agent.globalDir);
    const targetSkillPath = join(targetDir, skillName);

    try {
      // Ensure target directory exists
      const { mkdirSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });

      if (method === "symlink") {
        // Create symlink
        const { symlinkSync, existsSync } = await import("node:fs");
        if (existsSync(targetSkillPath)) {
          results.push({ agent: agentId, success: false, error: "Skill already exists" });
          continue;
        }
        const symlinkType = platform() === "win32" ? "junction" : "dir";
        symlinkSync(skillPath, targetSkillPath, symlinkType);
      } else {
        // Copy directory
        const { cpSync, existsSync } = await import("node:fs");
        if (existsSync(targetSkillPath)) {
          results.push({ agent: agentId, success: false, error: "Skill already exists" });
          continue;
        }
        cpSync(skillPath, targetSkillPath, { recursive: true });
      }

      results.push({ agent: agentId, success: true });
    } catch (err: any) {
      results.push({ agent: agentId, success: false, error: err.message });
    }
  }

  return results;
}

export { AGENT_DEFINITIONS, expandHome };
