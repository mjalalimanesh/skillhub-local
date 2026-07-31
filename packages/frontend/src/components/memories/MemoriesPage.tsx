import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Brain, RefreshCw } from "lucide-react";

export default function MemoriesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => api.getMemories(),
    staleTime: Infinity,
  });

  const memories = data?.memories || [];

  const byAgent = new Map<string, { toolName: string; memories: typeof memories }>();
  for (const m of memories) {
    const existing = byAgent.get(m.toolId);
    if (existing) {
      existing.memories.push(m);
    } else {
      byAgent.set(m.toolId, { toolName: m.toolName, memories: [m] });
    }
  }

  const agents = [...byAgent.entries()].sort((a, b) =>
    a[1].toolName.localeCompare(b[1].toolName)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memories"
        description={`${memories.length} memory files from ${agents.length} agents.`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["memories"] })}
          >
            <RefreshCw size={14} />
            Re-scan
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-ink-dim">Loading memories...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 text-ink-dim">
          No memory files found. Configure project directories in Settings to scan for project-scoped memories.
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map(([agentId, { toolName, memories: items }]) => (
            <Link
              key={agentId}
              to={`/memories/agent/${encodeURIComponent(agentId)}`}
            >
              <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Brain size={16} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                      {toolName}
                    </div>
                    <div className="text-xs text-ink-dim truncate">{agentId}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <Badge variant="default">
                    {items.length} {items.length === 1 ? "memory" : "memories"}
                  </Badge>
                  {items.some((m) => m.readOnly) && (
                    <Badge variant="warning">read-only</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
