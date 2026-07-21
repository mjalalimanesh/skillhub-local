import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Package,
  TrendingUp,
  ArrowUpCircle,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
} from "lucide-react";

export default function DashboardPage() {
  const { data: agentData } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const { data: skillData } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });

  const { data: trending } = useQuery({
    queryKey: ["trending"],
    queryFn: api.getTrending,
  });

  const progress = useAppStore((s) => s.progress);
  const agents = agentData?.agents || [];
  const skills = skillData?.skills || [];
  const detectedAgents = agents.filter((a) => a.detected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your agents, skills, and store activity."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Bot size={18} />}
          label="Agents Detected"
          value={detectedAgents.length}
          accent="accent"
          to="/agents"
        />
        <StatCard
          icon={<Package size={18} />}
          label="Total Skills"
          value={skills.length}
          accent="success"
          to="/skills"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Agents Supported"
          value={agents.length}
          accent="warning"
          to="/agents"
        />
        <StatCard
          icon={<ArrowUpCircle size={18} />}
          label="Trending in Store"
          value={trending?.skills?.length || 0}
          accent="accent"
          to="/store"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-muted mb-3">
            Detected Agents
          </h2>
          <div className="space-y-2">
            {detectedAgents.map((agent) => (
              <Link
                key={agent.id}
                to={`/skills?agent=${agent.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-raised hover:border-accent/50 border border-transparent transition-colors"
              >
                <span className="text-sm font-medium text-ink">
                  {agent.name}
                </span>
                <span className="text-xs text-ink-muted">
                  {agent.skillCount} skills
                </span>
              </Link>
            ))}
            {detectedAgents.length === 0 && (
              <p className="text-sm text-ink-dim">No agents detected yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-muted mb-3">
            Recent Skills
          </h2>
          <div className="space-y-2">
            {skills.slice(0, 5).map((skill) => (
              <Link
                key={skill.id}
                to={`/skills/${skill.name}`}
                className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-raised hover:border-accent/50 border border-transparent transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-ink">
                    {skill.name}
                  </span>
                  <span className="text-xs text-ink-dim ml-2">
                    ({skill.agentId})
                  </span>
                </div>
                <span className="text-xs text-ink-muted">{skill.scope}</span>
              </Link>
            ))}
            {skills.length === 0 && (
              <p className="text-sm text-ink-dim">No skills installed yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink-muted mb-3">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {progress.length === 0 ? (
              <p className="text-sm text-ink-dim">
                No activity yet. Install or remove skills to see events here.
              </p>
            ) : (
              progress
                .slice(-10)
                .reverse()
                .map((event, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 px-3 rounded-[var(--radius-sm)] bg-raised"
                  >
                    <ActivityIcon type={event.type} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-ink">{event.message}</span>
                    </div>
                    {event.skill && (
                      <Badge variant="default" className="shrink-0">
                        {event.skill}
                      </Badge>
                    )}
                  </div>
                ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const accentColors: Record<string, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
};

function StatCard({
  icon,
  label,
  value,
  accent,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:border-accent/30 transition-colors cursor-pointer">
        <div className="flex items-center gap-2 text-ink-muted mb-2">
          <span className={accentColors[accent] || "text-accent"}>{icon}</span>
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-2xl font-bold text-ink">{value}</div>
      </Card>
    </Link>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "install":
      return <Download size={14} className="text-success shrink-0" />;
    case "remove":
      return <AlertTriangle size={14} className="text-danger shrink-0" />;
    case "update":
      return <RefreshCw size={14} className="text-accent shrink-0" />;
    case "error":
      return <AlertTriangle size={14} className="text-danger shrink-0" />;
    default:
      return <CheckCircle2 size={14} className="text-ink-dim shrink-0" />;
  }
}
