export interface Agent {
  id: string;
  name: string;
  detected: boolean;
  skillCount: number;
  pluginCount: number;
  mcpCount: number;
  icon: string;
}

export interface Skill {
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
  projectId?: string;
  projectName?: string;
  projectRoot?: string;
}

export interface ProjectRoot {
  id: string;
  name: string;
  path: string;
}

export interface SkillFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  lastModified: string;
  isBinary: boolean;
}

export interface SkillFileWriteResult {
  agentId: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface StoreSkill {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  sourceType: "github";
  installUrl: string;
  url: string;
  isDuplicate: boolean;
}

export interface WSProgressEvent {
  type: "install" | "remove" | "update" | "error" | "done";
  skill?: string;
  agent?: string;
  message: string;
  progress?: number;
}

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

export interface MemoryFile {
  id: string;
  toolId: string;
  toolName: string;
  name: string;
  path: string;
  scope: "global" | "project";
  projectId?: string;
  projectName?: string;
  projectRoot?: string;
  size: number;
  lastModified: string;
  preview?: string;
  readOnly?: boolean;
}

export interface InstructionFile {
  id: string;
  toolId: string;
  toolName: string;
  name: string;
  path: string;
  scope: "global" | "project";
  projectId?: string;
  projectName?: string;
  projectRoot?: string;
  size: number;
  lastModified: string;
  preview?: string;
  hasFrontmatter: boolean;
  readOnly?: boolean;
}

export interface McpServer {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  scope: string;
  projectId?: string;
  projectName?: string;
  projectRoot?: string;
  sourceFile: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  type?: string;
  cwd?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled?: boolean;
  tools?: { enabled: string[]; disabled: string[] };
  raw: Record<string, unknown>;
}

export interface SkillOverlapGroup {
  agentId: string;
  agentName: string;
  reason: "identical" | "similar";
  similarity: number;
  skills: Skill[];
}
