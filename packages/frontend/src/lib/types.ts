export interface Agent {
  id: string;
  name: string;
  detected: boolean;
  skillCount: number;
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
