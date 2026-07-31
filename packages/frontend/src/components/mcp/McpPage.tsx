import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Terminal, Globe, Server, FileCode2, ChevronRight, ChevronDown } from "lucide-react";

interface McpServer {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  scope: "global" | "project";
  projectName?: string;
  sourceFile: string;
  transport: "stdio" | "http" | "sse" | "unknown";
  command?: string;
  args?: string[];
  url?: string;
  type?: string;
  enabled?: boolean;
  raw: Record<string, unknown>;
}

const transportLabels: Record<string, string> = {
  stdio: "stdio",
  http: "HTTP",
  sse: "SSE",
  unknown: "unknown",
};

export default function McpPage() {
  const [agentFilter, setAgentFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mcp", agentFilter],
    queryFn: () => api.getMcpServers(agentFilter === "all" ? undefined : agentFilter),
  });

  const servers = data?.servers || [];
  const agents = servers
    .reduce<{ id: string; name: string }[]>((acc, s) => {
      if (!acc.find((a) => a.id === s.agentId)) acc.push({ id: s.agentId, name: s.agentName });
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="MCP Servers"
        description="Model Context Protocol servers detected in your agents' configs."
        actions={
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <div className="text-ink-dim">Scanning agent configs...</div>
      ) : servers.length === 0 ? (
        <div className="text-center py-10 text-ink-dim text-sm">
          No MCP servers found. Configure servers in your agents (e.g.{" "}
          <code className="text-ink">~/.cursor/mcp.json</code>,{" "}
          <code className="text-ink">.mcp.json</code>,{" "}
          <code className="text-ink">~/.codex/config.toml</code>).
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => {
            const isExpanded = expanded === server.id;
            return (
              <div key={server.id}>
                <Card
                  className="px-4 py-3 cursor-pointer hover:border-line-strong transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : server.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-ink-dim shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-ink-dim shrink-0" />
                    )}
                    {server.transport === "stdio" ? (
                      <Terminal size={16} className="text-accent shrink-0" />
                    ) : (
                      <Globe size={16} className="text-accent shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink">{server.name}</span>
                        <Badge variant="accent" className="text-[11px]">
                          {server.agentName}
                        </Badge>
                        <Badge
                          variant={server.transport === "stdio" ? "default" : "warning"}
                          className="text-[11px]"
                        >
                          {transportLabels[server.transport]}
                        </Badge>
                        <Badge
                          variant={server.scope === "project" ? "success" : "default"}
                          className="text-[11px]"
                        >
                          {server.scope === "project"
                            ? `project${server.projectName ? ` · ${server.projectName}` : ""}`
                            : "global"}
                        </Badge>
                        {server.enabled === false && (
                          <Badge variant="danger" className="text-[11px]">
                            disabled
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-ink-dim mt-1 font-mono truncate">
                        {server.transport === "stdio"
                          ? `${server.command ?? ""}${server.args?.length ? ` ${server.args.join(" ")}` : ""}`
                          : server.url ?? server.sourceFile}
                      </div>
                      <div className="text-[11px] text-ink-dim mt-0.5 truncate">
                        {server.sourceFile}
                      </div>
                    </div>
                  </div>
                </Card>
                {isExpanded && (
                  <div className="ml-8 mt-2 space-y-2">
                    <div className="rounded-md bg-surface-secondary p-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <FileCode2 size={13} />
                        <span className="font-mono truncate">{server.sourceFile}</span>
                      </div>
                      {server.transport === "stdio" ? (
                        <div className="flex items-center gap-2 text-xs text-ink">
                          <Terminal size={13} className="text-ink-dim shrink-0" />
                          <span className="font-mono">
                            {server.command}
                            {server.args?.length ? ` ${server.args.join(" ")}` : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-ink">
                          <Globe size={13} className="text-ink-dim shrink-0" />
                          <span className="font-mono break-all">{server.url}</span>
                        </div>
                      )}
                      {server.type && (
                        <div className="flex items-center gap-2 text-xs text-ink-dim">
                          <Server size={13} className="shrink-0" />
                          type: <span className="font-mono">{server.type}</span>
                        </div>
                      )}
                      {server.enabled !== undefined && (
                        <div className="text-xs text-ink-dim">
                          enabled: {server.enabled ? "yes" : "no"}
                        </div>
                      )}
                    </div>
                    <pre className="rounded-md bg-surface-secondary p-3 text-[11px] text-ink-muted overflow-x-auto">
                      {JSON.stringify(server.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
