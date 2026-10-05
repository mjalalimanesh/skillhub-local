import { useEffect, useState } from "react";
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
import { Folder, ArrowUp, Loader2 } from "lucide-react";

// The native dialog opens on the machine running the backend, so it is only
// useful when the browser is on that same machine.
export function canUseNativePicker(): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    window.location.hostname
  );
}

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPath?: string;
  onSelect: (path: string) => void;
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  initialPath,
  onSelect,
}: FolderPickerDialogProps) {
  const [current, setCurrent] = useState<string | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [dirs, setDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (path: string, fallbackToHome = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.browse(path);
      setCurrent(res.path);
      setParent(res.parent);
      setDirs(res.directories);
    } catch (err) {
      if (fallbackToHome) {
        await load("~");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to read directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(initialPath?.trim() || "~", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sep = current?.includes("\\") ? "\\" : "/";
  const child = (name: string) =>
    current ? `${current.replace(/[\\/]$/, "")}${sep}${name}` : name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-line max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a folder</DialogTitle>
          <DialogDescription>
            Browsing the machine running SkillHub.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              title="Up one level"
              disabled={!parent || loading}
              onClick={() => parent && load(parent)}
            >
              <ArrowUp size={14} />
            </Button>
            <div className="text-xs font-mono text-ink-muted truncate" title={current ?? ""}>
              {current ?? ""}
            </div>
          </div>

          <div className="h-64 overflow-y-auto rounded-[var(--radius-md)] border border-line">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={16} className="animate-spin text-ink-dim" />
              </div>
            ) : error ? (
              <div className="p-3 text-sm text-danger">{error}</div>
            ) : dirs.length === 0 ? (
              <div className="p-3 text-sm text-ink-dim">No subfolders</div>
            ) : (
              dirs.map((name) => (
                <button
                  key={name}
                  onClick={() => load(child(name))}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-line/50"
                >
                  <Folder size={14} className="shrink-0 text-ink-dim" />
                  <span className="truncate">{name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!current || loading}
            onClick={() => {
              if (current) {
                onSelect(current);
                onOpenChange(false);
              }
            }}
          >
            Select this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
