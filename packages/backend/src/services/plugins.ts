import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

export interface Plugin {
  type: "source" | "agent" | "hook";
  name: string;
  [key: string]: unknown;
}

export interface UserPreferences {
  defaultScope: "global" | "project";
  defaultMethod: "symlink" | "copy";
  theme: "light" | "dark" | "system";
  telemetryEnabled: boolean;
}

export interface PluginConfig {
  version: number;
  plugins: Plugin[];
  preferences: UserPreferences;
}

const DEFAULT_CONFIG: PluginConfig = {
  version: 1,
  plugins: [],
  preferences: {
    defaultScope: "global",
    defaultMethod: "symlink",
    theme: "system",
    telemetryEnabled: false,
  },
};

const CONFIG_FILE = "skillhub.config.json";

async function configPath(): Promise<string> {
  const { homedir } = await import("node:os");
  return join(homedir(), CONFIG_FILE);
}

export async function loadConfig(): Promise<PluginConfig> {
  const p = await configPath();
  try {
    await access(p);
    const raw = await readFile(p, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: PluginConfig): Promise<void> {
  const p = await configPath();
  await writeFile(p, JSON.stringify(config, null, 2), "utf-8");
}

export async function addPlugin(plugin: Plugin): Promise<PluginConfig> {
  const config = await loadConfig();
  const existing = config.plugins.findIndex(
    (pl) => pl.type === plugin.type && pl.name === plugin.name
  );
  if (existing >= 0) {
    config.plugins[existing] = plugin;
  } else {
    config.plugins.push(plugin);
  }
  await saveConfig(config);
  return config;
}

export async function removePlugin(
  type: string,
  name: string
): Promise<PluginConfig> {
  const config = await loadConfig();
  config.plugins = config.plugins.filter(
    (pl) => !(pl.type === type && pl.name === name)
  );
  await saveConfig(config);
  return config;
}

export async function updatePreferences(
  prefs: Partial<UserPreferences>
): Promise<PluginConfig> {
  const config = await loadConfig();
  config.preferences = { ...config.preferences, ...prefs };
  await saveConfig(config);
  return config;
}
