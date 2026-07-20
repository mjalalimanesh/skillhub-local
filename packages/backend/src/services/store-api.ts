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
  description?: string;
  tags?: string[];
}

const API_BASE = "https://skills.sh/api/v1";

export async function searchSkills(
  query: string,
  limit = 20
): Promise<StoreSkill[]> {
  const url = `${API_BASE}/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh API error: ${res.status}`);
  const data = await res.json();
  return data.skills || data || [];
}

export async function getTrendingSkills(
  limit = 20
): Promise<StoreSkill[]> {
  const url = `${API_BASE}/skills?sort=trending&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh API error: ${res.status}`);
  const data = await res.json();
  return data.skills || data || [];
}

export async function getCuratedSkills(): Promise<StoreSkill[]> {
  const url = `${API_BASE}/skills/curated`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh API error: ${res.status}`);
  const data = await res.json();
  return data.skills || data || [];
}

export async function getSkillDetail(
  source: string,
  skill: string
): Promise<StoreSkill & { files?: string[]; audit?: Record<string, unknown> }> {
  const url = `${API_BASE}/skills/${source}/${skill}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh API error: ${res.status}`);
  return res.json();
}
