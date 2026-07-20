import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bot, Package, TrendingUp, ArrowUpCircle } from "lucide-react";

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

  const agents = agentData?.agents || [];
  const skills = skillData?.skills || [];
  const detectedAgents = agents.filter((a) => a.detected);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Bot size={20} />}
          label="Agents Detected"
          value={detectedAgents.length}
          color="text-primary"
        />
        <StatCard
          icon={<Package size={20} />}
          label="Total Skills"
          value={skills.length}
          color="text-success"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Agents Supported"
          value={agents.length}
          color="text-warning"
        />
        <StatCard
          icon={<ArrowUpCircle size={20} />}
          label="Trending in Store"
          value={trending?.skills?.length || 0}
          color="text-primary-hover"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-muted mb-3">Detected Agents</h2>
          <div className="space-y-2">
            {detectedAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-alt">
                <span className="text-sm font-medium">{agent.name}</span>
                <span className="text-xs text-text-muted">{agent.skillCount} skills</span>
              </div>
            ))}
            {detectedAgents.length === 0 && (
              <p className="text-sm text-text-dim">No agents detected yet.</p>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-muted mb-3">Recent Skills</h2>
          <div className="space-y-2">
            {skills.slice(0, 5).map((skill) => (
              <div key={skill.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-alt">
                <div>
                  <span className="text-sm font-medium">{skill.name}</span>
                  <span className="text-xs text-text-dim ml-2">({skill.agentId})</span>
                </div>
                <span className="text-xs text-text-muted">{skill.scope}</span>
              </div>
            ))}
            {skills.length === 0 && (
              <p className="text-sm text-text-dim">No skills installed yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-text-muted mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
