import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyToAgentsDialog } from "./CopyToAgentsDialog";
import { Package, Trash2, RefreshCw, Copy } from "lucide-react";
import { useToastStore } from "@/components/ui/toaster";

export default function SkillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAgent = searchParams.get("agent") || "all";
  const [filterAgent, setFilterAgent] = useState<string>(initialAgent);
  const [filterScope, setFilterScope] = useState<string>("all");
  const [copySkill, setCopySkill] = useState<{
    path: string;
    name: string;
    agent: string;
  } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    name: string;
    agentId: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      addToast({ type: "success", title: "Skill removed" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (skillName: string) =>
      api.updateSkill({ skills: [skillName] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      addToast({ type: "success", title: "Update complete" });
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Update failed", description: error.message });
    },
  });

  const skills = data?.skills || [];
  const agents = agentData?.agents || [];
  const detectedAgents = agents.filter((a) => a.detected);

  const filtered = skills.filter((s) => {
    if (filterAgent !== "all" && s.agentId !== filterAgent) return false;
    if (filterScope !== "all" && s.scope !== filterScope) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installed Skills"
        description={`${skills.length} total across all agents.`}
      />

      <div className="flex items-center gap-3">
        <Select
          value={filterAgent}
          onValueChange={(val) => {
            setFilterAgent(val);
            if (val === "all") {
              searchParams.delete("agent");
            } else {
              searchParams.set("agent", val);
            }
            setSearchParams(searchParams);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {detectedAgents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterScope} onValueChange={setFilterScope}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Scopes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scopes</SelectItem>
            <SelectItem value="global">Global</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-ink-dim">Loading skills...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((skill) => (
            <Card
              key={skill.id}
              className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group"
            >
              <Link
                to={`/skills/${skill.name}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <Package size={16} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                    {skill.name}
                  </div>
                  <div className="text-xs text-ink-dim truncate">
                    {skill.description}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                <Badge variant="default">{skill.agentId}</Badge>
                <span className="text-xs text-ink-dim">{skill.scope}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
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
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Update"
                    disabled={updateMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateMutation.mutate(skill.name);
                    }}
                  >
                    <RefreshCw
                      size={14}
                      className={
                        updateMutation.isPending ? "animate-spin" : ""
                      }
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRemoveTarget({
                        name: skill.name,
                        agentId: skill.agentId,
                      });
                    }}
                  >
                    <Trash2 size={14} className="text-danger" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-dim">
              No skills found.
            </div>
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

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove "${removeTarget?.name}"?`}
        description={`This will remove the skill from agent "${removeTarget?.agentId}".`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate({
              skill: removeTarget.name,
              agents: [removeTarget.agentId],
            });
            setRemoveTarget(null);
          }
        }}
        loading={removeMutation.isPending}
      />
    </div>
  );
}
