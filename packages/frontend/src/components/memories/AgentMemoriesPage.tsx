import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Brain, RefreshCw } from "lucide-react";

export default function AgentMemoriesPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const decodedId = decodeURIComponent(agentId || "");
  const queryClient = useQueryClient();

  const { data: memoriesData, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => api.getMemories(),
    staleTime: Infinity,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const allMemories = memoriesData?.memories || [];
  const memories = allMemories.filter((m) => m.toolId === decodedId);
  const agent = (agentsData?.agents || []).find((a) => a.id === decodedId);
  const agentName = agent?.name || memories[0]?.toolName || decodedId;

  const scopes = [...new Set(memories.map((m) => m.scope))];

  return (
    <div className="space-y-6">
      <PageHeader
        title={agentName}
        description={`${memories.length} memory files from ${agentName}.`}
        breadcrumbs={[
          { label: "Memories", href: "/memories" },
          { label: agentName },
        ]}
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

      {memories.length > 1 && (
        <div className="flex items-center gap-2">
          {scopes.map((s) => (
            <Badge key={s} variant={s === "global" ? "accent" : "success"}>
              {s}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-dim">Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 text-ink-dim">
          No memory files found for {agentName}.
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <Link
              key={memory.id}
              to={`/memories/${encodeURIComponent(memory.id)}`}
            >
              <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Brain size={16} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                      {memory.name}
                    </div>
                    <div className="text-xs text-ink-dim truncate">{memory.path}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <Badge variant={memory.scope === "global" ? "accent" : "success"}>
                    {memory.scope}
                  </Badge>
                  {memory.projectName && (
                    <span className="text-xs text-ink-dim">{memory.projectName}</span>
                  )}
                  {memory.readOnly && (
                    <Badge variant="warning">read-only</Badge>
                  )}
                  <span className="text-xs text-ink-dim">
                    {(memory.size / 1024).toFixed(1)}KB
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
