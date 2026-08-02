import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
import { cn } from "@/lib/utils";
import {
  Trash2,
  RefreshCw,
  Copy,
  Save,
  FileText,
  FileCode2,
  File as FileIcon,
  Image as ImageIcon,
  Folder,
} from "lucide-react";
import type { Skill, SkillFile } from "@/lib/types";

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "md") return <FileText size={14} />;
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(ext)) return <ImageIcon size={14} />;
  if (["js", "ts", "tsx", "jsx", "py", "sh", "json", "yaml", "yml", "toml", "css", "html", "mjs", "cjs", "rb", "go", "rs"].includes(ext)) return <FileCode2 size={14} />;
  return <FileIcon size={14} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function SkillDetailPage() {
  const { skillName } = useParams<{ skillName: string }>();
  const queryClient = useQueryClient();
  const agents = useAppStore((s) => s.agents);
  const addToast = useToastStore((s) => s.addToast);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [syncToInstances, setSyncToInstances] = useState(true);

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });

  const instances: Skill[] = (skillsData?.skills || []).filter(
    (s) => s.name === skillName
  );

  const primaryInstance = instances[0];

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["skillFiles", primaryInstance?.agentId, skillName],
    queryFn: () => api.getSkillFiles(primaryInstance!.agentId, skillName!),
    enabled: !!primaryInstance,
  });

  useEffect(() => {
    setSelectedPath(null);
    setEditorContent("");
    setIsDirty(false);
  }, [primaryInstance?.id]);

  useEffect(() => {
    if (!selectedPath && filesData?.files.length) {
      const skillMd = filesData.files.find((f) => f.relativePath === "SKILL.md");
      setSelectedPath((skillMd || filesData.files[0]).path);
    }
  }, [filesData, selectedPath]);

  const selectedFile: SkillFile | undefined = filesData?.files.find(
    (f) => f.path === selectedPath
  );

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["skillFileContent", primaryInstance?.agentId, skillName, selectedPath],
    queryFn: () => api.getSkillFileContent(primaryInstance!.agentId, skillName!, selectedPath!),
    enabled: !!primaryInstance && !!selectedPath,
  });

  useEffect(() => {
    if (contentData?.content !== undefined) {
      setEditorContent(contentData.content ?? "");
      setIsDirty(false);
    }
  }, [contentData]);

  const readOnly = !!primaryInstance?.pluginId;

  const selectFile = (path: string) => {
    if (path === selectedPath) return;
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    setSelectedPath(path);
  };

  const fileGroups: [string, SkillFile[]][] = (() => {
    const map = new Map<string, SkillFile[]>();
    for (const f of filesData?.files || []) {
      const idx = f.relativePath.lastIndexOf("/");
      const folder = idx === -1 ? "" : f.relativePath.slice(0, idx);
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

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

  const saveMutation = useMutation({
    mutationFn: () =>
      api.saveSkillFileContent(
        primaryInstance!.agentId,
        skillName!,
        selectedPath!,
        editorContent,
        syncToInstances
      ),
    onSuccess: (data) => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["skillDetail", primaryInstance?.agentId, skillName] });
      queryClient.invalidateQueries({ queryKey: ["skillFileContent", primaryInstance?.agentId, skillName] });
      queryClient.invalidateQueries({ queryKey: ["skillFiles", primaryInstance?.agentId, skillName] });
      const results = data.results || [];
      const updated = results.filter((r) => r.success && !r.skipped).length;
      const skipped = results.filter((r) => r.skipped).length;
      const parts: string[] = [];
      if (updated) parts.push(`saved to ${updated} agent${updated !== 1 ? "s" : ""}`);
      if (skipped) parts.push(`skipped ${skipped} (file missing)`);
      addToast({
        type: "success",
        title: "Skill file saved",
        description: parts.length ? parts.join(", ") : undefined,
      });
    },
    onError: (error: Error) => {
      addToast({ type: "error", title: "Save failed", description: error.message });
    },
  });

  if (skillsLoading || (primaryInstance && filesLoading)) {
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

      <div className="flex gap-4 items-start">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold text-ink-muted truncate">
                {selectedFile?.relativePath}
              </h2>
              {selectedFile?.isBinary && <Badge variant="warning">binary</Badge>}
              {readOnly && <Badge variant="warning">read-only (plugin skill)</Badge>}
              {selectedFile && (
                <span className="text-xs text-ink-dim">
                  {formatSize(selectedFile.size)}
                </span>
              )}
            </div>
            {!readOnly && !selectedFile?.isBinary && (
              <div className="flex items-center gap-3">
                {instances.length > 1 && (
                  <label className="flex items-center gap-1.5 text-xs text-ink-dim cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncToInstances}
                      onChange={(e) => setSyncToInstances(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    Save to all {instances.length} agents
                  </label>
                )}
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={!isDirty || saveMutation.isPending}
                >
                  <Save size={14} />
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>

          {contentLoading ? (
            <div className="text-ink-dim py-8">Loading content...</div>
          ) : selectedFile?.isBinary ? (
            <div className="bg-surface border border-line rounded-[var(--radius-md)] p-8 text-center text-sm text-ink-dim">
              Binary file — cannot be edited here.
            </div>
          ) : (
            <textarea
              className="w-full h-[500px] bg-surface border border-line rounded-[var(--radius-md)] p-4 text-sm text-ink font-mono whitespace-pre-wrap resize-y focus:outline-none focus:ring-2 focus:ring-accent/50"
              value={editorContent}
              onChange={(e) => {
                setEditorContent(e.target.value);
                setIsDirty(true);
              }}
              readOnly={readOnly}
            />
          )}
        </div>

        <Card className="p-2 w-64 shrink-0">
          <div className="px-2 pb-2 pt-1 text-xs font-semibold text-ink-muted flex items-center justify-between">
            <span>Files</span>
            <span>{filesData?.files.length ?? 0}</span>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto">
            {fileGroups.map(([folder, files]) => (
              <div key={folder || "(root)"}>
                {folder && (
                  <div className="px-2 pb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink-dim">
                    <Folder size={11} />
                    {folder}/
                  </div>
                )}
                <div className="space-y-0.5">
                  {files.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => selectFile(f.path)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-left text-sm transition-colors",
                        f.path === selectedPath
                          ? "bg-accent/10 text-accent"
                          : "text-ink hover:bg-raised"
                      )}
                    >
                      <span className="shrink-0">{fileIcon(f.name)}</span>
                      <span className="truncate flex-1">{f.name}</span>
                      {f.isBinary && (
                        <span className="text-[10px] text-ink-dim border border-line rounded px-1">
                          bin
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {fileGroups.length === 0 && (
              <div className="px-2 py-4 text-xs text-ink-dim text-center">
                No files
              </div>
            )}
          </div>
        </Card>
      </div>

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
