import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToastStore } from "@/components/ui/toaster";
import { Save } from "lucide-react";
import type { InstructionFile } from "@/lib/types";

export default function InstructionDetailPage() {
  const { instructionId } = useParams<{ instructionId: string }>();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: instructionsData } = useQuery({
    queryKey: ["instructions"],
    queryFn: () => api.getInstructions(),
    staleTime: Infinity,
  });

  const instruction: InstructionFile | undefined = (instructionsData?.instructions || []).find(
    (i) => i.id === decodeURIComponent(instructionId || "")
  );

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["instructionContent", instruction?.path],
    queryFn: () => api.getInstructionContent(instruction!.path),
    enabled: !!instruction,
  });

  const [editorContent, setEditorContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (contentData?.content !== undefined) {
      setEditorContent(contentData.content);
      setIsDirty(false);
    }
  }, [contentData]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveInstructionContent(instruction!.path, editorContent),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["instructions"] });
      addToast({ type: "success", title: "Instruction saved" });
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Save failed", description: error.message });
    },
  });

  if (!instruction) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Instruction Not Found"
          breadcrumbs={[
            { label: "Instructions", href: "/instructions" },
            { label: instructionId || "" },
          ]}
        />
      </div>
    );
  }

  const projectName = instruction.projectName || "Global";
  const projectId = instruction.projectId || "__global__";

  return (
    <div className="space-y-6">
      <PageHeader
        title={instruction.name}
        description={instruction.toolName}
        breadcrumbs={[
          { label: "Instructions", href: "/instructions" },
          { label: projectName, href: `/instructions/project/${encodeURIComponent(projectId)}` },
          { label: instruction.name },
        ]}
        actions={
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
          >
            <Save size={14} />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        }
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-ink-dim">
          <span>Tool: <span className="text-ink">{instruction.toolName}</span></span>
          <span>Scope: <Badge variant={instruction.scope === "global" ? "accent" : "success"}>{instruction.scope}</Badge></span>
          {instruction.projectName && <span>Project: <span className="text-ink">{instruction.projectName}</span></span>}
          <span>Size: <span className="text-ink">{(instruction.size / 1024).toFixed(1)}KB</span></span>
          <span>Modified: <span className="text-ink">{new Date(instruction.lastModified).toLocaleDateString()}</span></span>
          {instruction.hasFrontmatter && <Badge variant="default">has frontmatter</Badge>}
        </div>
        <div className="text-xs text-ink-dim break-all">Path: {instruction.path}</div>
      </Card>

      {contentLoading ? (
        <div className="text-ink-dim py-8">Loading content...</div>
      ) : (
        <textarea
          className="w-full h-[500px] bg-surface border border-line rounded-[var(--radius-md)] p-4 text-sm text-ink font-mono whitespace-pre-wrap resize-y focus:outline-none focus:ring-2 focus:ring-accent/50"
          value={editorContent}
          onChange={(e) => {
            setEditorContent(e.target.value);
            setIsDirty(true);
          }}
        />
      )}
    </div>
  );
}
