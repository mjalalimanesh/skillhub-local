import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, AlertTriangle } from "lucide-react";
import type { AgentTemplate } from "@/lib/types";

interface ApplyTemplateDialogProps {
  template: AgentTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplyTemplateDialog({
  template,
  open,
  onOpenChange,
}: ApplyTemplateDialogProps) {
  const [targetPath, setTargetPath] = useState("");
  const [alsoClaude, setAlsoClaude] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
    enabled: open,
  });
  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (open) {
      setTargetPath("");
      setAlsoClaude(false);
      setConflict(false);
      setError(null);
      setShowManual(false);
    }
  }, [open]);

  const pickFolder = async () => {
    try {
      const { path } = await api.pickFolder();
      if (path) {
        setTargetPath(path);
        setError(null);
      }
    } catch {
      // user cancelled the native picker
    }
  };

  const apply = async (force: boolean) => {
    if (!template || !targetPath.trim()) return;
    setError(null);
    try {
      await api.applyTemplate({
        id: template.id,
        targetPath: targetPath.trim(),
        alsoClaude,
        force,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply template";
      if (message.includes("already exists")) {
        setConflict(true);
      }
      setError(message);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-line max-w-lg">
        <DialogHeader>
          <DialogTitle>Add "{template.name}" to a project</DialogTitle>
          <DialogDescription>
            Writes AGENTS.md{alsoClaude ? " and CLAUDE.md" : ""} into the selected
            project directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted">Project directory</label>
            {projects.length > 0 ? (
              <>
                <Select
                  value={projects.some((p) => p.path === targetPath) ? targetPath : ""}
                  onValueChange={(v) => {
                    setTargetPath(v);
                    setConflict(false);
                    setError(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.path}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showManual ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="/path/to/project"
                      value={targetPath}
                      onChange={(e) => {
                        setTargetPath(e.target.value);
                        setConflict(false);
                        setError(null);
                      }}
                      autoFocus
                    />
                    <Button variant="secondary" size="md" onClick={pickFolder} className="shrink-0">
                      <FolderOpen size={14} />
                      Browse
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowManual(true)}
                    className="text-xs text-ink-dim hover:text-accent transition-colors"
                  >
                    Use another folder…
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">
                  No projects configured yet — add directories under{" "}
                  <Link to="/settings" className="text-accent hover:underline">
                    Settings → Project Directories
                  </Link>{" "}
                  or pick a folder below.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="/path/to/project"
                    value={targetPath}
                    onChange={(e) => {
                      setTargetPath(e.target.value);
                      setConflict(false);
                      setError(null);
                    }}
                  />
                  <Button variant="secondary" size="md" onClick={pickFolder} className="shrink-0">
                    <FolderOpen size={14} />
                    Browse
                  </Button>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={alsoClaude}
              onChange={(e) => setAlsoClaude(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Also write CLAUDE.md (same content)
          </label>

          {error && (
            <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2 space-y-2">
              <div className="flex items-start gap-2 text-xs text-danger">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {error.includes("outside allowed roots") && (
                <p className="text-xs text-ink-muted pl-6">
                  Add this directory under{" "}
                  <Link to="/settings" className="text-accent hover:underline">
                    Settings → Project Directories
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {conflict ? (
            <Button variant="danger" onClick={() => apply(true)}>
              Overwrite existing file
            </Button>
          ) : (
            <Button onClick={() => apply(false)} disabled={!targetPath.trim()}>
              Add to project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
