const BASE = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  getAgents: () =>
    request<{ agents: Array<{ id: string; name: string; detected: boolean; skillCount: number; icon: string }> }>("/api/agents"),

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

  removeSkill: (body: { skill: string; agents: string[]; global?: boolean }) =>
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

  addPlugin: (plugin: any) =>
    request<any>("/api/plugins", {
      method: "POST",
      body: JSON.stringify(plugin),
    }),

  removePlugin: (type: string, name: string) =>
    request<any>(`/api/plugins/${type}/${name}`, { method: "DELETE" }),
};
