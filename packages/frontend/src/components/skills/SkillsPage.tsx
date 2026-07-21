import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Package, Trash2, RefreshCw, Copy, Filter } from "lucide-react";
import { CopyToAgentsDialog } from "./CopyToAgentsDialog";

export default function SkillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAgent = searchParams.get("agent") || "all";
  const [filterAgent, setFilterAgent] = useState<string>(initialAgent);
  const [filterScope, setFilterScope] = useState<string>("all");
  const [copySkill, setCopySkill] = useState<{ path: string; name: string; agent: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });

  const { data: agentData } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const removeMutation = useMutation({
    mutationFn: (params: { skill: string; agents: string[] }) =>
      api.removeSkill(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skills"] }),
  });

  const skills = data?.skills || [];
  const agents = agentData?.agents || [];

  const filtered = skills.filter((s) => {
    if (filterAgent !== "all" && s.agentId !== filterAgent) return false;
    if (filterScope !== "all" && s.scope !== filterScope) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Installed Skills</h1>
        <span className="text-sm text-text-muted">{skills.length} total</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <Filter size={14} className="text-text-dim" />
          <select
            value={filterAgent}
            onChange={(e) => {
              setFilterAgent(e.target.value);
              if (e.target.value === "all") {
                searchParams.delete("agent");
              } else {
                searchParams.set("agent", e.target.value);
              }
              setSearchParams(searchParams);
            }}
            className="bg-transparent text-sm text-text outline-none"
          >
            <option value="all">All Agents</option>
            {agents.filter((a) => a.detected).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <Filter size={14} className="text-text-dim" />
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="bg-transparent text-sm text-text outline-none"
          >
            <option value="all">All Scopes</option>
            <option value="global">Global</option>
            <option value="project">Project</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-text-dim">Loading skills...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 hover:border-border-hover transition-colors group"
            >
              <Link
                to={`/skills/${skill.name}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <Package size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                    {skill.name}
                  </div>
                  <div className="text-xs text-text-dim truncate">{skill.description}</div>
                </div>
              </Link>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                <span className="text-xs bg-surface-alt px-2 py-1 rounded text-text-muted">
                  {skill.agentId}
                </span>
                <span className="text-xs text-text-dim">{skill.scope}</span>
                <div className="flex gap-1">
                  <button
                    className="p-1.5 rounded hover:bg-surface-alt text-text-dim hover:text-primary transition-colors"
                    title="Copy to other agents"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCopySkill({
                        path: skill.path,
                        name: skill.name,
                        agent: skill.agentId,
                      });
                    }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-surface-alt text-text-dim hover:text-text transition-colors"
                    title="Update"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-surface-alt text-text-dim hover:text-danger transition-colors"
                    title="Remove"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeMutation.mutate({
                        skill: skill.name,
                        agents: [skill.agentId],
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-text-dim">No skills found.</div>
          )}
        </div>
      )}

      {copySkill && (
        <CopyToAgentsDialog
          open={!!copySkill}
          onOpenChange={(open) => !open && setCopySkill(null)}
          skillPath={copySkill.path}
          skillName={copySkill.name}
          sourceAgent={copySkill.agent}
        />
      )}
    </div>
  );
}
