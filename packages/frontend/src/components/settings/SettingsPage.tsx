import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastStore } from "@/components/ui/toaster";
import { Plus, Trash2, FolderOpen, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  const saveMutation = useMutation({
    mutationFn: (prefs: Record<string, unknown>) =>
      api.saveConfig({
        ...config,
        preferences: { ...config?.preferences, ...prefs },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      addToast({ type: "success", title: "Settings saved" });
    },
  });

  const saveProjectDirsMutation = useMutation({
    mutationFn: (projectDirs: string[]) =>
      api.saveConfig({
        ...config,
        projectDirs,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      queryClient.invalidateQueries({ queryKey: ["instructions"] });
      addToast({ type: "success", title: "Project directories saved" });
    },
  });

  const prefs = config?.preferences || {
    defaultScope: "global",
    defaultMethod: "symlink",
    theme: "system",
    telemetryEnabled: false,
  };

  const [localDirs, setLocalDirs] = useState<string[]>([]);
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (config?.projectDirs) {
      setLocalDirs(config.projectDirs);
    }
  }, [config?.projectDirs]);

  const handleNativePick = async (idx: number) => {
    setPickingIdx(idx);
    try {
      const result = await api.pickFolder();
      const updated = [...localDirs];
      updated[idx] = result.path;
      setLocalDirs(updated);
      saveProjectDirsMutation.mutate(updated);
    } catch {
      // user cancelled
    } finally {
      setPickingIdx(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure SkillHub defaults and preferences."
      />

      <Card className="p-6 space-y-6 max-w-2xl">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-muted">
            Default Scope
          </label>
          <Select
            value={prefs.defaultScope}
            onValueChange={(val) =>
              saveMutation.mutate({ defaultScope: val })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                Global (available across all projects)
              </SelectItem>
              <SelectItem value="project">
                Project (current directory only)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-muted">
            Default Installation Method
          </label>
          <Select
            value={prefs.defaultMethod}
            onValueChange={(val) =>
              saveMutation.mutate({ defaultMethod: val })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="symlink">
                Symlink (recommended, auto-updates)
              </SelectItem>
              <SelectItem value="copy">
                Copy (independent, no permissions needed)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-ink-dim">
            Copy mode recommended for Windows if symlink creation fails.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-muted">Theme</label>
          <Select
            value={prefs.theme}
            onValueChange={(val) => saveMutation.mutate({ theme: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink-muted">Telemetry</div>
            <div className="text-xs text-ink-dim">
              Send anonymous usage data to help improve SkillHub.
            </div>
          </div>
          <button
            onClick={() =>
              saveMutation.mutate({
                telemetryEnabled: !prefs.telemetryEnabled,
              })
            }
            className={`w-10 h-5 rounded-full transition-colors ${
              prefs.telemetryEnabled ? "bg-accent" : "bg-line"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                prefs.telemetryEnabled
                  ? "translate-x-5"
                  : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </Card>

      <Card className="p-6 space-y-4 max-w-2xl">
        <div>
          <div className="text-sm font-medium text-ink-muted">Project Directories</div>
          <div className="text-xs text-ink-dim">
            Root folders to scan for projects. Each immediate subdirectory is treated as a separate project.
          </div>
        </div>

        <div className="space-y-2">
          {localDirs.map((dir, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={dir}
                onChange={(e) => {
                  const updated = [...localDirs];
                  updated[idx] = e.target.value;
                  setLocalDirs(updated);
                }}
                onBlur={() => saveProjectDirsMutation.mutate(localDirs)}
                placeholder="e.g. D:\\code or ~/repos"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNativePick(idx)}
                disabled={pickingIdx === idx}
                title="Browse"
              >
                {pickingIdx === idx ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FolderOpen size={14} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const updated = localDirs.filter((_, i) => i !== idx);
                  setLocalDirs(updated);
                  saveProjectDirsMutation.mutate(updated);
                }}
              >
                <Trash2 size={14} className="text-danger" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLocalDirs([...localDirs, ""])}
          >
            <Plus size={14} />
            Add Directory
          </Button>
        </div>
      </Card>
    </div>
  );
}
