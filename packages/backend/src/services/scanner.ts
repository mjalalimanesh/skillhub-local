import { readdir, stat, readFile, access } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { detectInstalledPlugins } from "./installed-plugins.js";
import { detectMcpServers } from "./mcp-scanner.js";
import { loadConfig } from "./plugins.js";

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
  mcpCount: number;
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
  const config = await loadConfig();
  const allMcpServers = await detectMcpServers(config.projectDirs || []);

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

    // Count MCP servers configured for this agent
    const mcpCount = allMcpServers.filter((s) => s.agentId === agent.id).length;

    results.push({
      id: agent.id,
      name: agent.name,
      configDir,
      skillDir: globalDir,
      detected,
      skillCount,
      pluginCount: agentPlugins.length,
      mcpCount,
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

export interface SkillFileInfo {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  lastModified: string;
  isBinary: boolean;
}

const BINARY_SIZE_LIMIT = 2 * 1024 * 1024;
const BINARY_CHECK_BYTES = 8192;

async function isBinaryFile(p: string, size: number): Promise<boolean> {
  if (size > BINARY_SIZE_LIMIT) return true;
  try {
    const { open } = await import("node:fs/promises");
    const handle = await open(p, "r");
    try {
      const buffer = Buffer.alloc(BINARY_CHECK_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, BINARY_CHECK_BYTES, 0);
      return buffer.subarray(0, bytesRead).includes(0);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

export async function listSkillFiles(skillPath: string): Promise<SkillFileInfo[]> {
  const files: SkillFileInfo[] = [];
  const root = resolve(skillPath);

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        let st;
        try {
          st = await stat(full);
        } catch {
          continue;
        }
        files.push({
          name: entry.name,
          path: full,
          relativePath: relative(root, full).split(/[\\/]/).join("/"),
          size: st.size,
          lastModified: st.mtime.toISOString(),
          isBinary: await isBinaryFile(full, st.size),
        });
      }
    }
  };

  await walk(root);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

export async function readSkillFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

export async function writeSkillFile(filePath: string, content: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, content, "utf-8");
}

export function isUnderKnownSkillDir(p: string): boolean {
  const allowedBases = AGENT_DEFINITIONS.flatMap((a) => [
    expandHome(a.globalDir),
    ...(a.extraDirs || []).map(expandHome),
  ]);
  const resolved = resolve(p).replace(/[\\/]/g, "/");
  return allowedBases.some((base) => {
    const rp = resolve(base).replace(/[\\/]/g, "/");
    return resolved.startsWith(rp + "/") || resolved === rp;
  });
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

// ── Overlap detection ──────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "use", "when", "the", "a", "an", "for", "and", "or", "with", "this", "that",
  "your", "you", "it", "is", "are", "be", "to", "of", "in", "on", "as", "do",
  "at", "by", "from", "not", "but", "if", "how", "what", "which", "who", "can",
  "will", "all", "any", "each", "than", "them", "then", "also", "about",
  "code", "task", "skill", "agent", "tool", "file", "files", "work",
]);

function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("ing")) return word.slice(0, -3);
  if (word.endsWith("tion")) return word.slice(0, -4);
  if (word.endsWith("ness")) return word.slice(0, -4);
  if (word.endsWith("ment")) return word.slice(0, -4);
  if (word.endsWith("ies")) return word.slice(0, -3);
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[-_.\s]+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(stem)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function nameTokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .map(stem)
    .filter((w) => w.length > 1);
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / Math.min(a.size, b.size);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isSubset(small: Set<string>, large: Set<string>): boolean {
  for (const x of small) if (!large.has(x)) return false;
  return true;
}

export interface SkillOverlapGroup {
  agentId: string;
  agentName: string;
  reason: "identical" | "similar";
  similarity: number;
  skills: InstalledSkill[];
}

function buildOverlapClusters(
  agentId: string,
  agentName: string,
  skills: InstalledSkill[]
): SkillOverlapGroup[] {
  if (skills.length < 2) return [];

  const groups: SkillOverlapGroup[] = [];
  const used = new Set<number>();

  // Tier 1: exact normalized-name matches (identical)
  const nameMap = new Map<string, InstalledSkill[]>();
  for (const skill of skills) {
    const key = normalizeName(skill.name);
    const arr = nameMap.get(key) || [];
    arr.push(skill);
    nameMap.set(key, arr);
  }
  for (const [, group] of nameMap) {
    if (group.length < 2) continue;
    // Only flag if at least two entries have different paths
    const uniquePaths = new Set(group.map((s) => s.path));
    if (uniquePaths.size < 2) continue;
    groups.push({
      agentId,
      agentName,
      reason: "identical",
      similarity: 1,
      skills: group,
    });
    for (const s of group) used.add(skills.indexOf(s));
  }

  // Family suppression: if ≥3 skills share a first name token, don't flag pairs inside
  const firstTokenMap = new Map<string, Set<number>>();
  for (let i = 0; i < skills.length; i++) {
    if (used.has(i)) continue;
    const tokens = nameTokens(skills[i].name);
    if (tokens.length === 0) continue;
    const first = tokens[0];
    const set = firstTokenMap.get(first) || new Set();
    set.add(i);
    firstTokenMap.set(first, set);
  }
  const familyIndices = new Set<number>();
  for (const [, indices] of firstTokenMap) {
    if (indices.size >= 3) {
      for (const i of indices) familyIndices.add(i);
    }
  }

  // Tier 2: similar pairs
  const remaining = skills
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !used.has(i) && !familyIndices.has(i));
  const paired = new Set<number>();

  for (let a = 0; a < remaining.length; a++) {
    const sa = remaining[a].s;
    const ia = remaining[a].i;
    if (paired.has(ia)) continue;

    const na = new Set(nameTokens(sa.name));
    const da = new Set(tokenize(sa.description));
    const pairSkills: InstalledSkill[] = [sa];
    let bestSimilarity = 0;

    for (let b = a + 1; b < remaining.length; b++) {
      const sb = remaining[b].s;
      const ib = remaining[b].i;
      if (paired.has(ib)) continue;

      const nb = new Set(nameTokens(sb.name));
      const db = new Set(tokenize(sb.description));

      const nameOverlap = overlapCoefficient(na, nb);
      const descJaccard = jaccard(da, db);

      let similar = false;
      let score = 0;

      if (nameOverlap >= 0.5 && descJaccard >= 0.2) {
        similar = true;
        score = nameOverlap * 0.4 + descJaccard * 0.6;
      } else if (descJaccard >= 0.45 && overlapCoefficient(na, nb) > 0) {
        similar = true;
        score = descJaccard;
      } else if (isSubset(na, nb) || isSubset(nb, na)) {
        if (descJaccard >= 0.25) {
          similar = true;
          score = (nameOverlap + 1) * 0.3 + descJaccard * 0.7;
        }
      }

      if (similar && score > bestSimilarity) {
        bestSimilarity = score;
      }

      if (similar) {
        pairSkills.push(sb);
        paired.add(ib);
        paired.add(remaining[b].i);
      }
    }

    if (pairSkills.length >= 2) {
      groups.push({
        agentId,
        agentName,
        reason: "similar",
        similarity: Math.min(Math.round(bestSimilarity * 100), 99),
        skills: pairSkills,
      });
    }
  }

  return groups.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "identical" ? -1 : 1;
    return b.similarity - a.similarity;
  });
}

export async function findSkillOverlaps(
  agentId?: string
): Promise<SkillOverlapGroup[]> {
  const allSkills = await scanAllSkills(agentId);
  const agents = AGENT_DEFINITIONS;
  const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

  // Hash SKILL.md content for each skill to detect content-identical copies
  const contentHash = new Map<string, string>();
  for (const skill of allSkills) {
    try {
      const raw = await readFile(join(skill.path, "SKILL.md"), "utf-8");
      contentHash.set(skill.id, createHash("md5").update(raw).digest("hex"));
    } catch {
      contentHash.set(skill.id, "");
    }
  }

  const byAgent = new Map<string, InstalledSkill[]>();
  for (const skill of allSkills) {
    const arr = byAgent.get(skill.agentId) || [];
    arr.push(skill);
    byAgent.set(skill.agentId, arr);
  }

  const groups: SkillOverlapGroup[] = [];
  for (const [id, skills] of byAgent) {
    const name = agentNameMap.get(id) || id;
    groups.push(...buildOverlapClusters(id, name, skills));
  }

  return groups
    .filter((g) => g.reason === "similar")
    .filter((g) => {
      // Exclude if all skills in the group have identical content
      const hashes = new Set(g.skills.map((s) => contentHash.get(s.id) || ""));
      return hashes.size > 1;
    });
}

export { AGENT_DEFINITIONS, expandHome };
