import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ApplyTemplateDialog } from "./ApplyTemplateDialog";
import { Pencil, FolderInput } from "lucide-react";

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: api.getTemplates,
  });

  const template = data?.templates.find((t) => t.id === decodeURIComponent(templateId || ""));

  if (!isLoading && !template) {
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

  if (!template) {
    return <div className="text-ink-dim py-8">Loading template...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={template.description}
        breadcrumbs={[
          { label: "Templates", href: "/templates" },
          { label: template.name },
        ]}
        actions={
          <>
            {!template.builtin && (
              <Link to={`/templates/${encodeURIComponent(template.id)}/edit`}>
                <Button variant="secondary" size="sm">
                  <Pencil size={14} />
                  Edit
                </Button>
              </Link>
            )}
            <Button size="sm" onClick={() => setApplyOpen(true)}>
              <FolderInput size={14} />
              Add to project
            </Button>
          </>
        }
      />

      <Card className="flex items-center gap-3 px-4 py-3 text-xs text-ink-dim flex-wrap">
        <Badge variant={template.builtin ? "accent" : "success"}>
          {template.builtin ? "Built-in" : "Custom"}
        </Badge>
        {template.updatedAt && (
          <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
        )}
        {template.builtin && <span>Read-only</span>}
      </Card>

      <div className="min-h-[320px] bg-surface border border-line rounded-[var(--radius-md)] p-4 text-sm text-ink font-mono whitespace-pre-wrap leading-relaxed">
        {template.content}
      </div>

      <ApplyTemplateDialog
        template={template}
        open={applyOpen}
        onOpenChange={setApplyOpen}
      />
    </div>
  );
}
