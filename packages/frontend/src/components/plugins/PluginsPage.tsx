import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Puzzle, Plus, Trash2, GitBranch, Bot, Zap } from "lucide-react";

export default function PluginsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [pluginType, setPluginType] = useState<"source" | "agent" | "hook">("source");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.addPlugin({
        type: pluginType,
        name,
        ...(pluginType === "source" ? { repo } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setShowAdd(false);
      setName("");
      setRepo("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ type, name }: { type: string; name: string }) =>
      api.removePlugin(type, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["config"] }),
  });

  const plugins = config?.plugins || [];

  const typeIcons: Record<string, React.ReactNode> = {
    source: <GitBranch size={16} className="text-primary" />,
    agent: <Bot size={16} className="text-success" />,
    hook: <Zap size={16} className="text-warning" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plugins</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary-hover transition-colors"
        >
          <Plus size={14} /> Add Plugin
        </button>
      </div>
      <p className="text-sm text-text-muted">
        Extend SkillHub with custom sources, agents, and hooks.
      </p>

      {showAdd && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold">Add Plugin</h2>
          <div className="flex gap-3">
            {(["source", "agent", "hook"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPluginType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  pluginType === t
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-text-muted hover:bg-surface-alt"
                }`}
              >
                {typeIcons[t]} {t}
              </button>
            ))}
          </div>
          <input
            placeholder="Plugin name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text outline-none"
          />
          {pluginType === "source" && (
            <input
              placeholder="GitHub owner/repo (e.g. vercel-labs/skills)"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => addMutation.mutate()}
              disabled={!name || addMutation.isPending}
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 rounded-lg border border-border text-text-muted text-sm hover:bg-surface-alt transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {plugins.map((plugin: any, i: number) => (
          <div
            key={`${plugin.type}-${plugin.name}`}
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {typeIcons[plugin.type]}
              <div>
                <div className="text-sm font-medium">{plugin.name}</div>
                <div className="text-xs text-text-dim">{plugin.type} plugin</div>
              </div>
            </div>
            <button
              onClick={() =>
                removeMutation.mutate({ type: plugin.type, name: plugin.name })
              }
              className="p-1.5 rounded hover:bg-surface-alt text-text-dim hover:text-danger transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {plugins.length === 0 && (
          <div className="text-center py-12 text-text-dim">No plugins configured.</div>
        )}
      </div>
    </div>
  );
}
