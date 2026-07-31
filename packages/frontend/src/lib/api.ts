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
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  getAgents: () =>
    request<{ agents: Array<{ id: string; name: string; detected: boolean; skillCount: number; pluginCount: number; mcpCount: number; icon: string }> }>("/api/agents"),

  getAgentSkills: (agentId: string) =>
    request<{ agent: any; skills: any[] }>(`/api/agents/${agentId}/skills`),

  getSkillDetail: (agentId: string, skillName: string) =>
    request<{ skill: any; content: string }>(`/api/agents/${agentId}/skills/${skillName}`),

  getSkills: (params?: { agent?: string; scope?: string }) => {
    const qs = new URLSearchParams();
    if (params?.agent) qs.set("agent", params.agent);
    if (params?.scope) qs.set("scope", params.scope);
    const q = qs.toString();
    return request<{ skills: any[]; total: number }>(`/api/skills${q ? `?${q}` : ""}`);
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
    return request<{ servers: Array<{ id: string; name: string; agentId: string; agentName: string; scope: string; projectId?: string; projectName?: string; sourceFile: string; transport: string; command?: string; args?: string[]; url?: string; type?: string; enabled?: boolean; raw: Record<string, unknown> }>; total: number }>(`/api/mcp${qs}`);
  },

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
};
