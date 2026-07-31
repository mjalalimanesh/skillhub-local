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
import type { MemoryFile } from "@/lib/types";

export default function MemoryDetailPage() {
  const { memoryId } = useParams<{ memoryId: string }>();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: memoriesData } = useQuery({
    queryKey: ["memories"],
    queryFn: () => api.getMemories(),
    staleTime: Infinity,
  });

  const memory: MemoryFile | undefined = (memoriesData?.memories || []).find(
    (m) => m.id === decodeURIComponent(memoryId || "")
  );

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["memoryContent", memory?.path],
    queryFn: () => api.getMemoryContent(memory!.path),
    enabled: !!memory,
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
    mutationFn: () => api.saveMemoryContent(memory!.path, editorContent),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      addToast({ type: "success", title: "Memory saved" });
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Save failed", description: error.message });
    },
  });

  if (!memory) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Memory Not Found"
          breadcrumbs={[
            { label: "Memories", href: "/memories" },
            { label: memoryId || "" },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={memory.name}
        description={memory.toolName}
        breadcrumbs={[
          { label: "Memories", href: "/memories" },
          { label: memory.name },
        ]}
        actions={
          !memory.readOnly ? (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
            >
              <Save size={14} />
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          ) : undefined
        }
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-ink-dim">
          <span>Tool: <span className="text-ink">{memory.toolName}</span></span>
          <span>Scope: <Badge variant={memory.scope === "global" ? "accent" : "success"}>{memory.scope}</Badge></span>
          {memory.projectName && <span>Project: <span className="text-ink">{memory.projectName}</span></span>}
          <span>Size: <span className="text-ink">{(memory.size / 1024).toFixed(1)}KB</span></span>
          <span>Modified: <span className="text-ink">{new Date(memory.lastModified).toLocaleDateString()}</span></span>
          {memory.readOnly && <Badge variant="warning">read-only</Badge>}
        </div>
        <div className="text-xs text-ink-dim break-all">Path: {memory.path}</div>
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
          readOnly={memory.readOnly}
        />
      )}
    </div>
  );
}
