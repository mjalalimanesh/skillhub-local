import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronRight, CheckCircle2, XCircle, Puzzle } from "lucide-react";

export default function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const agents = data?.agents || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="AI coding agents detected on your system."
      />

      {isLoading ? (
        <div className="text-ink-dim">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  agent: {
    id: string;
    name: string;
    detected: boolean;
    skillCount: number;
    pluginCount: number;
    icon: string;
    builtInNote?: string;
  };
}) {
  return (
    <Link
      to={agent.detected ? `/skills?agent=${agent.id}` : "#"}
      className={cn(
        "block transition-colors group",
        agent.detected ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
      )}
    >
      <Card
        className={cn(
          "p-5 h-full",
          agent.detected
            ? "hover:border-accent/30"
            : "border-line/50"
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-accent" />
            <span className="font-semibold text-ink">{agent.name}</span>
          </div>
          {agent.detected ? (
            <CheckCircle2 size={16} className="text-success" />
          ) : (
            <XCircle size={16} className="text-ink-dim" />
          )}
        </div>

        <div className="text-sm text-ink-muted mb-1">
          {agent.detected ? (
            <span>
              {agent.skillCount} skill{agent.skillCount !== 1 ? "s" : ""}{" "}
              installed
            </span>
          ) : (
            <span>Not detected</span>
          )}
        </div>

        {agent.pluginCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-ink-dim mt-1">
            <Puzzle size={12} className="text-purple-500" />
            {agent.pluginCount} plugin{agent.pluginCount !== 1 ? "s" : ""}
          </div>
        )}

        {agent.builtInNote && (
          <div className="text-xs text-ink-dim mt-2 italic">
            {agent.builtInNote}
          </div>
        )}

        <div className="text-xs text-ink-dim mt-3 flex items-center gap-1 group-hover:text-accent transition-colors">
          View skills <ChevronRight size={12} />
        </div>
      </Card>
    </Link>
  );
}
