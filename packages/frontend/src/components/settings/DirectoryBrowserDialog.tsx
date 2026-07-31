import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Folder,
  ChevronRight,
  Loader2,
  Monitor,
} from "lucide-react";

interface DirectoryBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function DirectoryBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath = "",
}: DirectoryBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [manualPath, setManualPath] = useState(initialPath);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    if (open) {
      const start = initialPath || "~";
      setCurrentPath(start);
      setManualPath(initialPath);
    }
  }, [open, initialPath]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["browse", currentPath],
    queryFn: () => api.browse(currentPath),
    enabled: open && !!currentPath,
  });

  const handleNativePick = async () => {
    setIsPicking(true);
    try {
      const result = await api.pickFolder();
      onSelect(result.path);
      onOpenChange(false);
    } catch {
      // user cancelled or error — stay open
    } finally {
      setIsPicking(false);
    }
  };

  const handleNavigate = (dir: string) => {
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const next = currentPath.endsWith(sep)
      ? currentPath + dir
      : currentPath + sep + dir;
    setCurrentPath(next);
    setManualPath(next);
  };

  const handleGoUp = () => {
    if (data?.parent) {
      setCurrentPath(data.parent);
      setManualPath(data.parent);
    }
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onOpenChange(false);
  };

  const handleManualSubmit = () => {
    setCurrentPath(manualPath);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Directory</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full justify-start gap-2"
            onClick={handleNativePick}
            disabled={isPicking}
          >
            {isPicking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Monitor size={16} />
            )}
            {isPicking ? "Opening system dialog..." : "Browse with system dialog"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface px-2 text-ink-dim">or enter path manually</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              placeholder="e.g. D:\\projects or ~/repos"
              className="flex-1 font-mono text-xs"
            />
            <Button variant="secondary" size="sm" onClick={handleManualSubmit}>
              Go
            </Button>
          </div>

          {data && (
            <div className="flex items-center gap-1 text-xs text-ink-dim font-mono">
              <button
                onClick={() => setCurrentPath("~")}
                className="hover:text-ink-muted transition-colors"
              >
                ~
              </button>
              {currentPath
                .replace(/^~/, "")
                .split(/[/\\]/)
                .filter(Boolean)
                .map((segment, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight size={10} />
                    <button
                      onClick={() => {
                        const sep = currentPath.includes("\\") ? "\\" : "/";
                        const target =
                          "~" + sep + arr.slice(0, i + 1).join(sep);
                        setCurrentPath(target);
                        setManualPath(target);
                      }}
                      className="hover:text-ink-muted transition-colors"
                    >
                      {segment}
                    </button>
                  </span>
                ))}
            </div>
          )}

          <div className="border border-line rounded-[var(--radius-sm)] bg-raised max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-6 text-ink-dim">
                <Loader2 size={16} className="animate-spin mr-2" />
                Loading...
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-danger">
                Failed to read directory. Check the path and try again.
              </div>
            ) : data && data.directories.length > 0 ? (
              <div className="p-1">
                {data.parent && (
                  <button
                    onClick={handleGoUp}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-ink-muted hover:bg-surface hover:text-ink transition-colors"
                  >
                    <FolderOpen size={14} />
                    <span className="font-mono text-xs">..</span>
                  </button>
                )}
                {data.directories.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => handleNavigate(dir)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-ink hover:bg-surface hover:text-ink transition-colors"
                  >
                    <Folder size={14} className="text-accent shrink-0" />
                    <span className="font-mono text-xs truncate">{dir}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-ink-dim text-center">
                No subdirectories found
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect}>Select Directory</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
