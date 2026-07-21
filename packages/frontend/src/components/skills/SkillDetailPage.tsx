import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyToAgentsDialog } from "./CopyToAgentsDialog";
import {
  ArrowLeft,
  Package,
  Trash2,
  RefreshCw,
  Copy,
  AlertTriangle,
} from "lucide-react";
import type { Skill } from "@/lib/types";

export default function SkillDetailPage() {
  const { skillName } = useParams<{ skillName: string }>();
  const queryClient = useQueryClient();
  const agents = useAppStore((s) => s.agents);

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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setConfirmDelete(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateSkill({ skills: [skillName!] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["skillDetail"] });
    },
  });

  if (skillsLoading || detailLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-dim">
        Loading skill details...
      </div>
    );
  }

  if (!primaryInstance) {
    return (
      <div className="space-y-4">
        <Link
          to="/skills"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Skills
        </Link>
        <div className="text-center py-16 text-text-dim">
          Skill "{skillName}" not found.
        </div>
      </div>
    );
  }

  const detectedAgents = agents.filter((a) => a.detected);

  return (
    <div className="space-y-6">
      <Link
        to="/skills"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Skills
      </Link>

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Package size={24} className="text-primary" />
            <h1 className="text-2xl font-bold">{skillName}</h1>
          </div>
          {primaryInstance.description && (
            <p className="text-sm text-text-muted ml-9">
              {primaryInstance.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/20 border border-danger/50 text-danger text-sm font-medium hover:bg-danger/30 transition-colors"
        >
          <Trash2 size={14} />
          Delete from all ({instances.length})
        </button>
        <button
          onClick={() => setCopyDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-text text-sm font-medium hover:border-border-hover transition-colors"
        >
          <Copy size={14} />
          Copy to agents
        </button>
        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-text text-sm font-medium hover:border-border-hover disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={updateMutation.isPending ? "animate-spin" : ""} />
          {updateMutation.isPending ? "Updating..." : "Update"}
        </button>
      </div>

      {updateMutation.isSuccess && (
        <div className="text-sm text-success">Update complete.</div>
      )}
      {updateMutation.isError && (
        <div className="text-sm text-danger">
          Update failed: {updateMutation.error.message}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted">
          Installed in {instances.length} agent{instances.length !== 1 ? "s" : ""}
        </h2>
        <div className="flex flex-wrap gap-2">
          {instances.map((inst) => {
            const agent = detectedAgents.find((a) => a.id === inst.agentId);
            return (
              <span
                key={inst.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    agent?.detected ? "bg-success" : "bg-text-dim"
                  }`}
                />
                {agent?.name || inst.agentId}
                <span className="text-xs text-text-dim">({inst.scope})</span>
              </span>
            );
          })}
        </div>
      </div>

      {detailData?.content && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-muted">SKILL.md</h2>
          <pre className="bg-surface border border-border rounded-lg p-4 overflow-x-auto text-sm text-text font-mono whitespace-pre-wrap">
            {detailData.content}
          </pre>
        </div>
      )}

      {confirmDelete && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="bg-surface border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-danger" />
                Delete "{skillName}"?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-text-muted">
                This will remove "{skillName}" from{" "}
                <strong>{instances.length} agent{instances.length !== 1 ? "s" : ""}</strong>:
              </p>
              <ul className="text-sm text-text-muted list-disc list-inside space-y-1">
                {instances.map((inst) => {
                  const agent = detectedAgents.find((a) => a.id === inst.agentId);
                  return (
                    <li key={inst.id}>
                      {agent?.name || inst.agentId}
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 disabled:opacity-50 transition-colors"
                >
                  {removeMutation.isPending ? (
                    "Deleting..."
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete from all
                    </>
                  )}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg border border-border text-text-muted text-sm hover:bg-surface-alt transition-colors"
                >
                  Cancel
                </button>
              </div>
              {removeMutation.isError && (
                <div className="text-sm text-danger">
                  {removeMutation.error.message}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

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
