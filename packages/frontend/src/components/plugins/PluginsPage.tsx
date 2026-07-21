import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/components/ui/toaster";
import { Plus, Trash2, GitBranch, Bot, Zap, Download, Package } from "lucide-react";

export default function PluginsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [pluginType, setPluginType] = useState<"source" | "agent" | "hook">(
    "source"
  );
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  const { data: installedPluginsData } = useQuery({
    queryKey: ["installedPlugins"],
    queryFn: api.getInstalledPlugins,
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
      addToast({ type: "success", title: "Plugin added" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ type, name }: { type: string; name: string }) =>
      api.removePlugin(type, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      addToast({ type: "success", title: "Plugin removed" });
    },
  });

  const plugins = config?.plugins || [];
  const installedPlugins = installedPluginsData?.plugins || [];

  const typeIcons: Record<string, React.ReactNode> = {
    source: <GitBranch size={16} className="text-accent" />,
    agent: <Bot size={16} className="text-success" />,
    hook: <Zap size={16} className="text-warning" />,
  };

  const sourceIcons: Record<string, React.ReactNode> = {
    cursor: <Package size={16} className="text-blue-500" />,
    codex: <Package size={16} className="text-green-500" />,
    "claude-code": <Bot size={16} className="text-orange-500" />,
    opencode: <Zap size={16} className="text-purple-500" />,
    "gemini-cli": <Zap size={16} className="text-red-500" />,
    other: <Download size={16} className="text-gray-500" />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plugins"
        description="Extend SkillHub with custom sources, agents, and hooks."
        actions={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Plugin
          </Button>
        }
      />

      {showAdd && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Add Plugin</h2>
          <div className="flex gap-3">
            {(["source", "agent", "hook"] as const).map((t) => (
              <Button
                key={t}
                variant={pluginType === t ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPluginType(t)}
              >
                {typeIcons[t]} {t}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Plugin name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {pluginType === "source" && (
            <Input
              placeholder="GitHub owner/repo (e.g. vercel-labs/skills)"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!name || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Installed Plugins Section */}
      {installedPlugins.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Installed Plugins</h2>
          <div className="space-y-2">
            {installedPlugins.map((plugin) => (
              <Card
                key={plugin.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {sourceIcons[plugin.agentId] || sourceIcons.other}
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {plugin.name}
                    </div>
                    <div className="text-xs text-ink-dim">
                      {plugin.agentName} plugin · {plugin.skillCount} skills
                      {plugin.version && ` · v${plugin.version}`}
                    </div>
                    {plugin.description && (
                      <div className="text-xs text-ink-dim mt-1">
                        {plugin.description}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="default" className="text-xs">
                  {plugin.skillCount} skills
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* User Configured Plugins Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Custom Plugins</h2>
        <div className="space-y-2">
          {plugins.map((plugin: any, i: number) => (
            <Card
              key={`${plugin.type}-${plugin.name}`}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {typeIcons[plugin.type]}
                <div>
                  <div className="text-sm font-medium text-ink">
                    {plugin.name}
                  </div>
                  <div className="text-xs text-ink-dim">
                    {plugin.type} plugin
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  removeMutation.mutate({
                    type: plugin.type,
                    name: plugin.name,
                  })
                }
              >
                <Trash2 size={14} className="text-danger" />
              </Button>
            </Card>
          ))}
          {plugins.length === 0 && (
            <div className="text-center py-6 text-ink-dim text-sm">
              No custom plugins configured.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
