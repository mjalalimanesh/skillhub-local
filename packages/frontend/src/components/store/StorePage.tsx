import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { Store, Search, Download, Check, ExternalLink } from "lucide-react";

export default function StorePage() {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const agents = useAppStore((s) => s.agents);
  const detectedAgents = agents.filter((a) => a.detected);

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["storeSearch", query],
    queryFn: () => api.searchSkills(query),
    enabled: query.length > 0,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: api.getTrending,
  });

  const [installing, setInstalling] = useState<Set<string>>(new Set());

  const installMutation = useMutation({
    mutationFn: (params: {
      source: string;
      skill: string;
      agents: string[];
      global: boolean;
      copy: boolean;
    }) => api.installSkill(params),
    onMutate: (params) => {
      setInstalling((prev) => new Set(prev).add(params.skill));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skills"] }),
    onSettled: (_data, _error, params) => {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(params.skill);
        return next;
      });
    },
  });

  const skills = query ? (searchResults?.skills || []) : (trending?.skills || []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Skill Store</h1>
      <p className="text-sm text-text-muted">
        Browse and install skills from the {">"}950K installs ecosystem.
      </p>

      <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-2.5 w-full max-w-xl">
        <Search size={16} className="text-text-dim" />
        <input
          type="text"
          placeholder="Search skills (e.g. frontend-design, playwright, data-analysis)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent text-sm text-text outline-none flex-1"
        />
      </div>

      {searching && <div className="text-text-dim">Searching...</div>}

      <div className="space-y-2">
        {skills.map((skill: any) => (
          <div
            key={skill.id}
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 hover:border-border-hover transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{skill.name}</span>
                {skill.isDuplicate && (
                  <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Duplicate</span>
                )}
              </div>
              <div className="text-xs text-text-dim mt-0.5">
                {skill.source} &middot; {skill.installs?.toLocaleString() || 0} installs
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={skill.url}
                target="_blank"
                rel="noopener"
                className="p-1.5 rounded hover:bg-surface-alt text-text-dim hover:text-text transition-colors"
                title="View on skills.sh"
              >
                <ExternalLink size={14} />
              </a>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs font-medium transition-colors"
                onClick={() => {
                  if (detectedAgents.length > 0) {
                    installMutation.mutate({
                      source: skill.source,
                      skill: skill.slug || skill.name,
                      agents: detectedAgents.map((a) => a.id),
                      global: true,
                      copy: false,
                    });
                  }
                }}
                disabled={installing.has(skill.slug || skill.name)}
              >
                <Download size={12} />
                {installing.has(skill.slug || skill.name) ? "Installing..." : "Install"}
              </button>
            </div>
          </div>
        ))}
        {skills.length === 0 && !searching && (
          <div className="text-center py-12 text-text-dim">
            {query
              ? "No skills found for this query."
              : trendingLoading
                ? "Loading trending skills..."
                : "No trending skills available."}
          </div>
        )}
      </div>
    </div>
  );
}
