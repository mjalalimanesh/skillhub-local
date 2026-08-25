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
import { Package, Trash2, RefreshCw, Copy, Puzzle, Layers, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
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
    path: string;
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

  const { data: overlapData } = useQuery({
    queryKey: ["overlaps", filterAgent],
    queryFn: () => api.getSkillOverlaps(filterAgent === "all" ? undefined : filterAgent),
  });

  const removeMutation = useMutation({
    mutationFn: (params: { skill: string; agents: string[]; skillPath?: string }) =>
      api.removeSkill(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["overlaps"] });
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
  const overlapGroups = overlapData?.groups || [];

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

      {overlapGroups.length > 0 && (
        <OverlapsSection
          groups={overlapGroups}
          onRemove={(name, agentId, path) => {
            setRemoveTarget({ name, agentId, path });
          }}
        />
      )}

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
                to={
                  skill.scope === "project" && skill.projectId
                    ? `/skills/${skill.name}?project=${encodeURIComponent(skill.projectId)}`
                    : `/skills/${skill.name}`
                }
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                {skill.pluginId ? (
                  <Puzzle size={16} className="text-purple-500 shrink-0" />
                ) : (
                  <Package size={16} className="text-accent shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                    {skill.pluginName ? (
                      <span>
                        <span className="text-ink-dim">{skill.pluginName}:</span>
                        {skill.name.split(":").slice(1).join(":")}
                      </span>
                    ) : (
                      skill.name
                    )}
                  </div>
                  <div className="text-xs text-ink-dim truncate">
                    {skill.description}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                {skill.pluginId && (
                  <Badge variant="accent" className="text-xs">plugin</Badge>
                )}
                {skill.scope === "project" && skill.projectName && (
                  <Badge variant="success" className="text-xs gap-1">
                    <FolderOpen size={10} />
                    {skill.projectName}
                  </Badge>
                )}
                <Badge variant="default">{skill.agentId}</Badge>
                <Badge variant={skill.scope === "global" ? "accent" : "success"} className="text-xs">
                  {skill.scope}
                </Badge>
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
                    title={skill.pluginId ? "Plugin skills cannot be removed" : "Remove"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (skill.pluginId) {
                        addToast({
                          type: "error",
                          title: "Cannot remove plugin skill",
                          description: "This skill belongs to a plugin and is managed by the agent. Uninstall the plugin from the agent (Cursor, Codex, etc.) to remove it.",
                        });
                        return;
                      }
                      setRemoveTarget({
                        name: skill.name,
                        agentId: skill.agentId,
                        path: skill.path,
                      });
                    }}
                  >
                    <Trash2 size={14} className={skill.pluginId ? "text-ink-dim" : "text-danger"} />
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
        description={`This will delete "${removeTarget?.name}" from disk and remove it from agent "${removeTarget?.agentId}".`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate({
              skill: removeTarget.name,
              agents: [removeTarget.agentId],
              skillPath: removeTarget.path,
            });
            setRemoveTarget(null);
          }
        }}
        loading={removeMutation.isPending}
      />
    </div>
  );
}

function OverlapsSection({
  groups,
  onRemove,
}: {
  groups: Array<{
    agentId: string;
    agentName: string;
    reason: "identical" | "similar";
    similarity: number;
    skills: Array<{
      id: string;
      name: string;
      description: string;
      agentId: string;
      scope: string;
      path: string;
      pluginId?: string;
      pluginName?: string;
    }>;
  }>;
  onRemove: (name: string, agentId: string, path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-raised/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-warning" />
          <span className="text-sm font-medium text-ink">
            Potential overlaps
          </span>
          <Badge variant="warning" className="text-xs">
            {groups.length}
          </Badge>
        </div>
        {collapsed ? (
          <ChevronRight size={14} className="text-ink-dim" />
        ) : (
          <ChevronDown size={14} className="text-ink-dim" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-line">
          {groups.map((group, gi) => (
            <div
              key={`${group.agentId}-${group.reason}-${gi}`}
              className="px-4 py-3 border-b border-line/50 last:border-b-0"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={group.reason === "identical" ? "danger" : "warning"}
                  className="text-xs"
                >
                  {group.reason === "identical" ? "identical" : "similar"}
                </Badge>
                {group.reason === "similar" && (
                  <span className="text-xs text-ink-dim">
                    {group.similarity}% match
                  </span>
                )}
                <Badge variant="default" className="text-xs">
                  {group.agentName}
                </Badge>
              </div>

              <div className="space-y-1.5">
                {group.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-raised/50"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/skills/${skill.name}`}
                        className="text-sm text-ink hover:text-accent transition-colors"
                      >
                        {skill.pluginName ? (
                          <span>
                            <span className="text-ink-dim">{skill.pluginName}:</span>
                            {skill.name.split(":").slice(1).join(":")}
                          </span>
                        ) : (
                          skill.name
                        )}
                      </Link>
                      <div className="text-xs text-ink-dim truncate mt-0.5">
                        {skill.path}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {skill.pluginId && (
                        <Badge variant="accent" className="text-xs">plugin</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Remove duplicate instance"
                        onClick={() => onRemove(skill.name, skill.agentId, skill.path)}
                      >
                        <Trash2 size={12} className="text-danger" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
