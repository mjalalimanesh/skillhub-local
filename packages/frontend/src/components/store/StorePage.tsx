import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/components/ui/toaster";
import { Search, Download, ExternalLink } from "lucide-react";

export default function StorePage() {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const agents = useAppStore((s) => s.agents);
  const addToast = useToastStore((s) => s.addToast);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      addToast({ type: "success", title: "Skill installed" });
    },
    onError: () => {
      addToast({ type: "error", title: "Installation failed" });
    },
    onSettled: (_data, _error, params) => {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(params.skill);
        return next;
      });
    },
  });

  const skills = query ? searchResults?.skills || [] : trending?.skills || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Store"
        description="Browse and install skills from the ecosystem."
      />

      <div className="relative max-w-xl">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim"
        />
        <Input
          placeholder="Search skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {searching && <div className="text-ink-dim">Searching...</div>}

      <div className="space-y-2">
        {skills.map((skill: any) => (
          <Card
            key={skill.id}
            className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {skill.name}
                </span>
                {skill.isDuplicate && (
                  <Badge variant="warning">Duplicate</Badge>
                )}
              </div>
              <div className="text-xs text-ink-dim mt-0.5">
                {skill.source} &middot;{" "}
                {skill.installs?.toLocaleString() || 0} installs
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={skill.url}
                target="_blank"
                rel="noopener"
                className="text-ink-dim hover:text-ink transition-colors"
                title="View on skills.sh"
              >
                <ExternalLink size={14} />
              </a>
              <Button
                variant="primary"
                size="sm"
                disabled={installing.has(skill.slug || skill.name)}
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
              >
                <Download size={12} />
                {installing.has(skill.slug || skill.name)
                  ? "Installing..."
                  : "Install"}
              </Button>
            </div>
          </Card>
        ))}
        {skills.length === 0 && !searching && (
          <div className="text-center py-12 text-ink-dim">
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
