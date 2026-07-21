import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/components/ui/toaster";
import { Copy, Check, X } from "lucide-react";

interface CopyToAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillPath: string;
  skillName: string;
  sourceAgent: string;
}

export function CopyToAgentsDialog({
  open,
  onOpenChange,
  skillPath,
  skillName,
  sourceAgent,
}: CopyToAgentsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const agents = useAppStore((s) => s.agents);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const copyMutation = useMutation({
    mutationFn: () =>
      api.copySkill({
        skillPath,
        targetAgents: [...selected],
        method: "copy",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      onOpenChange(false);
      setSelected(new Set());
      addToast({ type: "success", title: "Skill copied" });
    },
  });

  const availableAgents = agents.filter(
    (a) => a.detected && a.id !== sourceAgent
  );

  const toggleAgent = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(availableAgents.map((a) => a.id)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-line max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy size={16} className="text-accent" />
            Copy "{skillName}" to agents
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-dim">
              {selected.size} of {availableAgents.length} selected
            </span>
            <button
              onClick={selectAll}
              className="text-xs text-accent hover:text-accent-hover"
            >
              Select all
            </button>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {availableAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] text-sm transition-colors ${
                  selected.has(agent.id)
                    ? "bg-accent/10 border border-accent/30"
                    : "bg-raised border border-line hover:border-line-strong"
                }`}
              >
                <span className="text-ink">{agent.name}</span>
                {selected.has(agent.id) ? (
                  <Check size={14} className="text-accent" />
                ) : (
                  <span className="text-xs text-ink-dim">
                    {agent.skillCount} skills
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => copyMutation.mutate()}
              disabled={selected.size === 0 || copyMutation.isPending}
              className="flex-1"
            >
              {copyMutation.isPending ? (
                "Copying..."
              ) : (
                <>
                  <Copy size={14} />
                  Copy to {selected.size} agent
                  {selected.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>

          {copyMutation.data && (
            <div className="mt-2 space-y-1">
              {copyMutation.data.results.map((r) => (
                <div
                  key={r.agent}
                  className={`text-xs flex items-center gap-1 ${
                    r.success ? "text-success" : "text-danger"
                  }`}
                >
                  {r.success ? <Check size={12} /> : <X size={12} />}
                  {r.agent}: {r.success ? "Copied" : r.error}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
