import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyToAgentsDialog } from "./CopyToAgentsDialog";
import { useToastStore } from "@/components/ui/toaster";
import { Trash2, RefreshCw, Copy } from "lucide-react";
import type { Skill } from "@/lib/types";

export default function SkillDetailPage() {
  const { skillName } = useParams<{ skillName: string }>();
  const queryClient = useQueryClient();
  const agents = useAppStore((s) => s.agents);
  const addToast = useToastStore((s) => s.addToast);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });

  const instances: Skill[] = (skillsData?.skills || []).filter(
    (s) => s.name === skillName
  );

  const primaryInstance = instances[0];

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["skillDetail", primaryInstance?.agentId, skillName],
    queryFn: () => api.getSkillDetail(primaryInstance!.agentId, skillName!),
    enabled: !!primaryInstance,
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      api.removeSkill({
        skill: skillName!,
        agents: instances.map((i) => i.agentId),
        skillPath: primaryInstance?.path,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setConfirmDelete(false);
      addToast({ type: "success", title: `"${skillName}" deleted` });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateSkill({ skills: [skillName!] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["skillDetail"] });
      addToast({ type: "success", title: "Update complete" });
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Update failed", description: error.message });
    },
  });

  if (skillsLoading || detailLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-dim">
        Loading skill details...
      </div>
    );
  }

  if (!primaryInstance) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Skill Not Found"
          breadcrumbs={[
            { label: "Skills", href: "/skills" },
            { label: skillName || "" },
          ]}
        />
      </div>
    );
  }

  const detectedAgents = agents.filter((a) => a.detected);

  return (
    <div className="space-y-6">
      <PageHeader
        title={skillName || ""}
        description={primaryInstance.description || undefined}
        breadcrumbs={[
          { label: "Skills", href: "/skills" },
          { label: skillName || "" },
        ]}
        actions={
          <>
            <Button
              variant="danger"
              size="sm"
              disabled={!!primaryInstance?.pluginId}
              onClick={() => {
                if (primaryInstance?.pluginId) {
                  addToast({
                    type: "error",
                    title: "Cannot remove plugin skill",
                    description: "This skill belongs to a plugin and is managed by the agent. Uninstall the plugin from the agent (Cursor, Codex, etc.) to remove it.",
                  });
                  return;
                }
                setConfirmDelete(true);
              }}
            >
              <Trash2 size={14} />
              Delete ({instances.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCopyDialogOpen(true)}
            >
              <Copy size={14} />
              Copy to agents
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              <RefreshCw
                size={14}
                className={updateMutation.isPending ? "animate-spin" : ""}
              />
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </>
        }
      />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-muted">
          Installed in {instances.length} agent
          {instances.length !== 1 ? "s" : ""}
        </h2>
        <div className="flex flex-wrap gap-2">
          {instances.map((inst) => {
            const agent = detectedAgents.find((a) => a.id === inst.agentId);
            return (
              <Badge key={inst.id} variant="default" className="gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    agent?.detected ? "bg-success" : "bg-ink-dim"
                  }`}
                />
                {agent?.name || inst.agentId}
                <span className="text-ink-dim">({inst.scope})</span>
              </Badge>
            );
          })}
        </div>
      </div>

      {detailData?.content && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">SKILL.md</h2>
          <pre className="bg-surface border border-line rounded-[var(--radius-md)] p-4 overflow-x-auto text-sm text-ink font-mono whitespace-pre-wrap">
            {detailData.content}
          </pre>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${skillName}"?`}
        description={`This will remove "${skillName}" from ${instances.length} agent${instances.length !== 1 ? "s" : ""}.`}
        confirmLabel="Delete from all"
        confirmVariant="danger"
        onConfirm={() => removeMutation.mutate()}
        loading={removeMutation.isPending}
      />

      {copyDialogOpen && primaryInstance && (
        <CopyToAgentsDialog
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
          skillPath={primaryInstance.path}
          skillName={skillName!}
          sourceAgent={primaryInstance.agentId}
        />
      )}
    </div>
  );
}
