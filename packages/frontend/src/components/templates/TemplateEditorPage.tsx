import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToastStore } from "@/components/ui/toaster";
import { Save, Trash2 } from "lucide-react";

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const isEditMode = !!templateId;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: api.getTemplates,
    enabled: isEditMode,
  });

  const template = isEditMode
    ? data?.templates.find((t) => t.id === decodeURIComponent(templateId))
    : undefined;

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setContent(template.content);
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim(),
        content,
      };
      return isEditMode && templateId
        ? api.updateTemplate(decodeURIComponent(templateId), body)
        : api.createTemplate(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      addToast({ type: "success", title: isEditMode ? "Template saved" : "Template created" });
      navigate("/templates");
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Save failed", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTemplate(decodeURIComponent(templateId || "")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      addToast({ type: "success", title: "Template deleted" });
      navigate("/templates");
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Delete failed", description: error.message });
    },
  });

  if (isEditMode && !isLoading && !template) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Template Not Found"
          breadcrumbs={[
            { label: "Templates", href: "/templates" },
            { label: templateId || "" },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? "Edit Template" : "New Template"}
        breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: isEditMode ? "Edit" : "New" }]}
        actions={
          <>
            {isEditMode && template && !template.builtin && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
                Delete
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={
                !name.trim() ||
                !content.trim() ||
                (isEditMode && template?.builtin) ||
                saveMutation.isPending
              }
            >
              <Save size={14} />
              {saveMutation.isPending ? "Saving..." : template?.builtin ? "Built-in" : "Save"}
            </Button>
          </>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted">Name</label>
            <Input
              placeholder="e.g. Strict TypeScript rules"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted">Description</label>
            <Input
              placeholder="What is this rule set for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink-muted">Content (markdown)</label>
          <textarea
            className="w-full h-[420px] bg-surface border border-line rounded-[var(--radius-md)] p-4 text-sm text-ink font-mono whitespace-pre-wrap resize-y focus:outline-none focus:ring-2 focus:ring-accent/50"
            placeholder={"- Rule one\n- Rule two"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="text-xs text-ink-dim">
            Applied templates are written as AGENTS.md (optionally CLAUDE.md) into the
            target project.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete template?"
        description={`"${name}" will be permanently removed.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
