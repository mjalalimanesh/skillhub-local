import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToastStore } from "@/components/ui/toaster";
import { ApplyTemplateDialog } from "./ApplyTemplateDialog";
import { Plus, Pencil, Trash2, FolderInput, Sparkles, FileText } from "lucide-react";
import type { AgentTemplate } from "@/lib/types";

function TemplateCard({
  template,
  onApply,
  onDelete,
}: {
  template: AgentTemplate;
  onApply: (t: AgentTemplate) => void;
  onDelete?: (t: AgentTemplate) => void;
}) {
  const navigate = useNavigate();
  const preview = template.content.trim().split("\n").slice(0, 3).join(" ").slice(0, 160);
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link to={`/templates/${encodeURIComponent(template.id)}`} className="block">
      <Card className="p-4 flex flex-col gap-3 hover:border-line-strong transition-colors group cursor-pointer h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-accent shrink-0" />
            <h3 className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
              {template.name}
            </h3>
          </div>
          <Badge variant={template.builtin ? "accent" : "success"}>
            {template.builtin ? "Built-in" : "Custom"}
          </Badge>
        </div>

        <p className="text-xs text-ink-muted">{template.description}</p>
        {preview && (
          <p className="text-xs text-ink-dim font-mono line-clamp-3 leading-relaxed">
            {preview}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <Button size="sm" onClick={(e) => { stop(e); onApply(template); }}>
            <FolderInput size={14} />
            Add to project
          </Button>
          {!template.builtin && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  stop(e);
                  navigate(`/templates/${encodeURIComponent(template.id)}/edit`);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted hover:text-ink hover:bg-raised transition-colors"
                title="Edit template"
              >
                <Pencil size={14} />
              </button>
              {onDelete && (
                <button
                  onClick={(e) => { stop(e); onDelete(template); }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  title="Delete template"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [applyTarget, setApplyTarget] = useState<AgentTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: api.getTemplates,
  });

  const templates = data?.templates || [];
  const builtIn = templates.filter((t) => t.builtin);
  const custom = templates.filter((t) => !t.builtin);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTarget(null);
      addToast({ type: "success", title: "Template deleted" });
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Delete failed", description: error.message });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Reusable AGENTS.md rule sets you can drop into any project."
        actions={
          <Link to="/templates/new">
            <Button size="sm">
              <Plus size={14} />
              New Template
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="text-ink-dim">Loading templates...</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-dim flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent" />
              Built-in
            </h2>
            {builtIn.length === 0 ? (
              <div className="text-sm text-ink-dim">No built-in templates.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {builtIn.map((t) => (
                  <TemplateCard key={t.id} template={t} onApply={setApplyTarget} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              My Templates
            </h2>
            {custom.length === 0 ? (
              <Card className="px-4 py-6 text-center text-sm text-ink-dim">
                No custom templates yet. Create one or edit a copy of a built-in idea
                via{" "}
                <Link to="/templates/new" className="text-accent hover:underline">
                  New Template
                </Link>
                .
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {custom.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onApply={setApplyTarget}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ApplyTemplateDialog
        template={applyTarget}
        open={!!applyTarget}
        onOpenChange={(open) => {
          if (!open) setApplyTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete template?"
        description={
          <>
            "{deleteTarget?.name}" will be permanently removed. Projects where it was
            already applied are not affected.
          </>
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
