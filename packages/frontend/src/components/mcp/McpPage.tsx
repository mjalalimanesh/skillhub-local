import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Terminal, Globe, Search } from "lucide-react";
import type { McpServer } from "@/lib/types";

const transportLabels: Record<string, string> = {
  stdio: "stdio",
  http: "HTTP",
  sse: "SSE",
  unknown: "unknown",
};

export default function McpPage() {
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");

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

  const query = search.trim().toLowerCase();
  const filtered = query
    ? servers.filter((s) =>
        [s.name, s.agentName, s.command, s.url, s.sourceFile, ...(s.args ?? [])]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(query))
      )
    : servers;

  return (
    <div className="space-y-6">
      <PageHeader
        title="MCP Servers"
        description="Model Context Protocol servers detected in your agents' configs."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search servers..."
                className="w-56 pl-8"
              />
            </div>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-44">
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
          </div>
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-ink-dim text-sm">
          No servers match "{search}".
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((server) => (
            <Link key={server.id} to={`/mcp/${encodeURIComponent(server.id)}`}>
              <Card className="px-4 py-3 hover:border-line-strong transition-colors">
                <div className="flex items-center gap-3">
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
                        {transportLabels[server.transport] ?? server.transport}
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
