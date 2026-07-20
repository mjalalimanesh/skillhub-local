import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bot, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

export default function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const agents = data?.agents || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agents</h1>
      <p className="text-sm text-text-muted">
        AI coding agents detected on your system. Click an agent to view its installed skills.
      </p>

      {isLoading ? (
        <div className="text-text-dim">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
}: {
  agent: { id: string; name: string; detected: boolean; skillCount: number; icon: string; builtInNote?: string };
}) {
  return (
    <div
      className={cn(
        "bg-surface border rounded-xl p-5 transition-colors cursor-pointer group",
        agent.detected
          ? "border-border hover:border-primary/50"
          : "border-border/50 opacity-50"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-primary" />
          <span className="font-semibold">{agent.name}</span>
        </div>
        {agent.detected ? (
          <CheckCircle2 size={16} className="text-success" />
        ) : (
          <XCircle size={16} className="text-text-dim" />
        )}
      </div>

      <div className="text-sm text-text-muted mb-1">
        {agent.detected ? (
          <span>{agent.skillCount} skill{agent.skillCount !== 1 ? "s" : ""} installed</span>
        ) : (
          <span>Not detected</span>
        )}
      </div>

      {agent.builtInNote && (
        <div className="text-xs text-text-dim mt-2 italic">{agent.builtInNote}</div>
      )}

      <div className="text-xs text-text-dim mt-3 flex items-center gap-1 group-hover:text-primary transition-colors">
        View skills <ChevronRight size={12} />
      </div>
    </div>
  );
}
