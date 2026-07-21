import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastStore } from "@/components/ui/toaster";

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

  const prefs = config?.preferences || {
    defaultScope: "global",
    defaultMethod: "symlink",
    theme: "system",
    telemetryEnabled: false,
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
    </div>
  );
}
