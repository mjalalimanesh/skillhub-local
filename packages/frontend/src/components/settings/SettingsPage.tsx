import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  const saveMutation = useMutation({
    mutationFn: (prefs: Record<string, unknown>) =>
      api.saveConfig({ ...config, preferences: { ...config?.preferences, ...prefs } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["config"] }),
  });

  const prefs = config?.preferences || {
    defaultScope: "global",
    defaultMethod: "symlink",
    theme: "system",
    telemetryEnabled: false,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-surface border border-border rounded-xl p-5 space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">
            Default Scope
          </label>
          <select
            value={prefs.defaultScope}
            onChange={(e) =>
              saveMutation.mutate({ defaultScope: e.target.value })
            }
            className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text outline-none"
          >
            <option value="global">Global (available across all projects)</option>
            <option value="project">Project (current directory only)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">
            Default Installation Method
          </label>
          <select
            value={prefs.defaultMethod}
            onChange={(e) =>
              saveMutation.mutate({ defaultMethod: e.target.value })
            }
            className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text outline-none"
          >
            <option value="symlink">Symlink (recommended, auto-updates)</option>
            <option value="copy">Copy (independent, no permissions needed)</option>
          </select>
          <p className="text-xs text-text-dim mt-1">
            Copy mode recommended for Windows if symlink creation fails.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">
            Theme
          </label>
          <select
            value={prefs.theme}
            onChange={(e) => saveMutation.mutate({ theme: e.target.value })}
            className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text outline-none"
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-muted">Telemetry</div>
            <div className="text-xs text-text-dim">
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
              prefs.telemetryEnabled ? "bg-primary" : "bg-border"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                prefs.telemetryEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
