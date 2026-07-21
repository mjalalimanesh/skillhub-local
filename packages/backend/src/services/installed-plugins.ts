import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import matter from "gray-matter";

export interface PluginSkill {
  name: string;
  path: string;
  description: string;
  frontmatter: Record<string, unknown>;
}

export interface InstalledPlugin {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  path: string;
  skillCount: number;
  skills: PluginSkill[];
  version?: string;
  description?: string;
}

interface PluginDirConfig {
  agentId: string;
  agentName: string;
  cacheDirs: string[];
}

const PLUGIN_DIR_CONFIGS: PluginDirConfig[] = [
  {
    agentId: "cursor",
    agentName: "Cursor",
    cacheDirs: ["~/.cursor/plugins/cache/cursor-public"],
  },
  {
    agentId: "codex",
    agentName: "Codex",
    cacheDirs: [
      "~/.codex/plugins/cache/openai-bundled",
      "~/.codex/plugins/cache/openai-curated",
      "~/.codex/plugins/cache/openai-curated-remote",
      "~/.codex/plugins/cache/openai-primary-runtime",
    ],
  },
  {
    agentId: "claude-code",
    agentName: "Claude Code",
    cacheDirs: ["~/.claude/plugins/marketplaces"],
  },
  {
    agentId: "opencode",
    agentName: "OpenCode",
    cacheDirs: ["~/.config/opencode/plugins/cache"],
  },
  {
    agentId: "gemini-cli",
    agentName: "Gemini CLI",
    cacheDirs: ["~/.gemini/plugins/cache"],
  },
];

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function expandHome(p: string): string {
  if (p.startsWith("~")) return join(homedir(), p.slice(1));
  return p;
}

async function findSkillsInDir(dir: string, depth = 0): Promise<PluginSkill[]> {
  const skills: PluginSkill[] = [];
  if (!(await pathExists(dir)) || depth > 4) return skills;

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const childDir = join(dir, entry.name);
      const skillMdPath = join(childDir, "SKILL.md");

      if (await pathExists(skillMdPath)) {
        try {
          const raw = await readFile(skillMdPath, "utf-8");
          const { data: frontmatter, content } = matter(raw);
          const description = (frontmatter.description as string) || content.split("\n").slice(0, 2).join(" ").trim();

          skills.push({
            name: entry.name,
            path: childDir,
            description,
            frontmatter,
          });
        } catch {
          // skip malformed skills
        }
      } else {
        const nested = await findSkillsInDir(childDir, depth + 1);
        skills.push(...nested);
      }
    }
  } catch {}

  return skills;
}

async function detectPluginsForAgent(config: PluginDirConfig): Promise<InstalledPlugin[]> {
  const plugins: InstalledPlugin[] = [];

  for (const cacheDir of config.cacheDirs) {
    const expandedDir = expandHome(cacheDir);
    if (!(await pathExists(expandedDir))) continue;

    try {
      const entries = await readdir(expandedDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginDir = join(expandedDir, entry.name);
        const versionDirs = await readdir(pluginDir, { withFileTypes: true });

        for (const versionDir of versionDirs) {
          if (!versionDir.isDirectory()) continue;

          const versionPath = join(pluginDir, versionDir.name);
          const skillsDir = join(versionPath, "skills");

          let skills: PluginSkill[] = [];
          if (await pathExists(skillsDir)) {
            skills = await findSkillsInDir(skillsDir);
          }

          if (skills.length > 0) {
            let version: string | undefined;
            let description: string | undefined;

            // Try package.json
            const pkgPath = join(versionPath, "package.json");
            if (await pathExists(pkgPath)) {
              try {
                const pkgRaw = await readFile(pkgPath, "utf-8");
                const pkg = JSON.parse(pkgRaw);
                version = pkg.version;
                description = pkg.description;
              } catch {}
            }

            // Try agent-specific metadata files
            const metaFiles = [
              ".cursor-plugin",
              ".codex-plugin",
              ".claude-plugin",
              ".opencode-plugin",
            ];

            if (!description) {
              for (const metaFile of metaFiles) {
                const metaPath = join(versionPath, metaFile);
                if (await pathExists(metaPath)) {
                  try {
                    const raw = await readFile(metaPath, "utf-8");
                    const { data } = matter(raw);
                    description = (data.description as string) || (data.name as string);
                    if (!version && data.version) version = data.version as string;
                    break;
                  } catch {}
                }
              }
            }

            plugins.push({
              id: `${config.agentId}::${entry.name}`,
              name: entry.name,
              agentId: config.agentId,
              agentName: config.agentName,
              path: versionPath,
              skillCount: skills.length,
              skills,
              version,
              description,
            });
          }
        }
      }
    } catch {}
  }

  return plugins;
}

export async function detectInstalledPlugins(): Promise<InstalledPlugin[]> {
  const allPlugins: InstalledPlugin[] = [];

  for (const config of PLUGIN_DIR_CONFIGS) {
    const plugins = await detectPluginsForAgent(config);
    allPlugins.push(...plugins);
  }

  return allPlugins;
}
