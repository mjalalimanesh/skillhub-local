import type { SkillFile, SkillFileWriteResult, ProjectRoot, AgentTemplate } from "@/lib/types";

const BASE = "";

let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function initAuth(): Promise<void> {
  try {
    const { token } = await request<{ token: string }>("/api/auth/token");
    setAuthToken(token);
  } catch (err) {
    console.warn("Failed to fetch auth token", err);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers["x-skillhub-token"] = authToken;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (
      res.status === 401 &&
      !authToken &&
      path !== "/api/auth/token"
    ) {
      await initAuth();
      if (authToken) return request(path, options);
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const detail = err.detail ? `: ${String(err.detail).slice(0, 300)}` : "";
    throw new Error(`${err.error || res.statusText}${detail}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  getAgents: () =>
    request<{ agents: Array<{ id: string; name: string; detected: boolean; skillCount: number; pluginCount: number; mcpCount: number; icon: string }> }>("/api/agents"),

  getAgentSkills: (agentId: string) =>
    request<{ agent: any; skills: any[] }>(`/api/agents/${agentId}/skills`),

  getSkillDetail: (agentId: string, skillName: string, project?: string) =>
    request<{ skill: any; content: string }>(
      `/api/agents/${agentId}/skills/${skillName}${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),

  getSkillFiles: (agentId: string, skillName: string, project?: string) =>
    request<{ files: SkillFile[] }>(
      `/api/agents/${agentId}/skills/${encodeURIComponent(skillName)}/files${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),

  getSkillFileContent: (agentId: string, skillName: string, path: string, project?: string) => {
    const qs = new URLSearchParams({ path });
    if (project) qs.set("project", project);
    return request<{ content: string | null; isBinary: boolean }>(
      `/api/agents/${agentId}/skills/${encodeURIComponent(skillName)}/files/content?${qs.toString()}`
    );
  },

  saveSkillFileContent: (
    agentId: string,
    skillName: string,
    path: string,
    content: string,
    syncToInstances?: boolean,
    project?: string
  ) =>
    request<{ success: boolean; results?: SkillFileWriteResult[] }>(
      `/api/agents/${agentId}/skills/${encodeURIComponent(skillName)}/files/content${project ? `?project=${encodeURIComponent(project)}` : ""}`,
      {
        method: "PUT",
        body: JSON.stringify({ path, content, syncToInstances }),
      }
    ),

  getSkills: (params?: { agent?: string; scope?: string }) => {
    const qs = new URLSearchParams();
    if (params?.agent) qs.set("agent", params.agent);
    if (params?.scope) qs.set("scope", params.scope);
    const q = qs.toString();
    return request<{ skills: any[]; total: number }>(`/api/skills${q ? `?${q}` : ""}`);
  },

  getProjects: () =>
    request<{ projects: ProjectRoot[]; total: number }>("/api/projects"),

  getSkillOverlaps: (agent?: string) => {
    const qs = agent ? `?agent=${encodeURIComponent(agent)}` : "";
    return request<{ groups: Array<{ agentId: string; agentName: string; reason: "identical" | "similar"; similarity: number; skills: any[] }> }>(`/api/skills/overlaps${qs}`);
  },

  installSkill: (body: {
    source: string;
    skill: string;
    agents: string[];
    global?: boolean;
    copy?: boolean;
  }) =>
    request<any>("/api/skills/install", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  removeSkill: (body: { skill: string; agents: string[]; skillPath?: string }) =>
    request<any>("/api/skills/remove", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateSkill: (body: { skills?: string[]; global?: boolean }) =>
    request<any>("/api/skills/update", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  copySkill: (body: {
    skillPath: string;
    targetAgents: string[];
    method?: "copy" | "symlink";
  }) =>
    request<{ results: Array<{ agent: string; success: boolean; error?: string }> }>("/api/skills/copy", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  searchSkills: (q: string) =>
    request<{ skills: any[] }>(`/api/skills/search?q=${encodeURIComponent(q)}`),

  getTrending: () =>
    request<{ skills: any[] }>("/api/skills/trending"),

  getCurated: () =>
    request<{ skills: any[] }>("/api/skills/curated"),

  getConfig: () => request<any>("/api/config"),

  saveConfig: (config: any) =>
    request<any>("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  browse: (path: string) =>
    request<{ path: string; parent: string; directories: string[] }>(
      `/api/browse?path=${encodeURIComponent(path)}`
    ),

  pickFolder: () => request<{ path: string }>("/api/browse/pick"),

  addPlugin: (plugin: any) =>
    request<any>("/api/plugins", {
      method: "POST",
      body: JSON.stringify(plugin),
    }),

  removePlugin: (type: string, name: string) =>
    request<any>(`/api/plugins/${type}/${name}`, { method: "DELETE" }),

  getInstalledPlugins: () =>
    request<{ plugins: Array<{ id: string; name: string; agentId: string; agentName: string; skillCount: number; skills: Array<{ name: string; path: string; description: string; frontmatter: Record<string, unknown> }>; version?: string; description?: string }> }>("/api/installed-plugins"),

  getMcpServers: (agent?: string) => {
    const qs = agent ? `?agent=${encodeURIComponent(agent)}` : "";
    return request<{ servers: Array<{ id: string; name: string; agentId: string; agentName: string; scope: string; projectId?: string; projectName?: string; sourceFile: string; transport: string; command?: string; args?: string[]; url?: string; type?: string; cwd?: string; env?: Record<string, string>; headers?: Record<string, string>; enabled?: boolean; tools?: { enabled: string[]; disabled: string[] }; raw: Record<string, unknown> }>; total: number }>(`/api/mcp${qs}`);
  },

  getMcpTools: (id: string) =>
    request<{ serverId: string; tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>; error?: string; authRequired?: boolean; authorizationUrl?: string }>("/api/mcp/tools", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  getMcpAuth: (id: string) =>
    request<{ headers: Record<string, string>; env: Record<string, string>; oauthAuthorized: boolean }>(`/api/mcp/auth/${encodeURIComponent(id)}`),

  setMcpAuth: (id: string, body: { headers?: Record<string, string>; env?: Record<string, string> }) =>
    request<{ headers: Record<string, string>; env: Record<string, string> }>(`/api/mcp/auth/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  clearMcpAuth: (id: string) =>
    request<{ success: boolean }>(`/api/mcp/auth/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  startMcpOAuth: (id: string) =>
    request<{ authorized: boolean; authorizationUrl?: string; error?: string }>("/api/mcp/oauth/start", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  getMcpOAuthStatus: (id: string) =>
    request<{ authorized: boolean }>("/api/mcp/oauth/status", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  getMemories: (params?: { tool?: string; scope?: string; project?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tool) qs.set("tool", params.tool);
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.project) qs.set("project", params.project);
    const q = qs.toString();
    return request<{ memories: any[]; total: number }>(`/api/memories${q ? `?${q}` : ""}`);
  },

  getMemoryContent: (path: string) =>
    request<{ content: string }>(`/api/memories/content?path=${encodeURIComponent(path)}`),

  saveMemoryContent: (path: string, content: string) =>
    request<{ success: boolean }>("/api/memories/content", {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    }),

  getInstructions: (params?: { tool?: string; scope?: string; project?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tool) qs.set("tool", params.tool);
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.project) qs.set("project", params.project);
    const q = qs.toString();
    return request<{ instructions: any[]; total: number }>(`/api/instructions${q ? `?${q}` : ""}`);
  },

  getInstructionContent: (path: string) =>
    request<{ content: string }>(`/api/instructions/content?path=${encodeURIComponent(path)}`),

  saveInstructionContent: (path: string, content: string) =>
    request<{ success: boolean }>("/api/instructions/content", {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    }),

  getTemplates: () =>
    request<{ templates: AgentTemplate[]; total: number }>("/api/templates"),

  createTemplate: (body: { name: string; description: string; content: string }) =>
    request<AgentTemplate>("/api/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateTemplate: (id: string, body: { name: string; description: string; content: string }) =>
    request<AgentTemplate>(`/api/templates/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteTemplate: (id: string) =>
    request<{ success: boolean }>(`/api/templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  applyTemplate: (body: {
    id?: string;
    content?: string;
    targetPath: string;
    alsoClaude?: boolean;
    force?: boolean;
  }) =>
    request<{ success: boolean; written: string[] }>("/api/templates/apply", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
