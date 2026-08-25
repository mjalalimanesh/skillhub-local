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
  Brain,
  FileText,
  Cable,
  FolderOpen,
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

  const { data: memoryData } = useQuery({
    queryKey: ["memories"],
    queryFn: () => api.getMemories(),
  });

  const { data: instructionData } = useQuery({
    queryKey: ["instructions"],
    queryFn: () => api.getInstructions(),
  });

  const { data: mcpData } = useQuery({
    queryKey: ["mcp", "all"],
    queryFn: () => api.getMcpServers(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const progress = useAppStore((s) => s.progress);
  const agents = agentData?.agents || [];
  const skills = skillData?.skills || [];
  const memories = memoryData?.memories || [];
  const instructions = instructionData?.instructions || [];
  const mcpServers = mcpData?.servers || [];
  const detectedAgents = agents.filter((a) => a.detected);
  const projects = projectsData?.projects || [];

  // Unique physical skills per project — shared dirs (.agents/skills) are
  // attributed to many agents but must count once per project.
  const projectSkillKeys = new Map<string, Set<string>>();
  for (const s of skills) {
    if (s.scope !== "project" || !s.projectId) continue;
    let set = projectSkillKeys.get(s.projectId);
    if (!set) {
      set = new Set();
      projectSkillKeys.set(s.projectId, set);
    }
    set.add(`${s.name}|${s.path}`);
  }
  const projectCounts = new Map<
    string,
    { skills: number; memories: number; instructions: number; mcp: number }
  >();
  const countsFor = (id: string) => {
    let c = projectCounts.get(id);
    if (!c) {
      c = {
        skills: projectSkillKeys.get(id)?.size || 0,
        memories: 0,
        instructions: 0,
        mcp: 0,
      };
      projectCounts.set(id, c);
    }
    return c;
  };
  for (const m of memories) {
    if (m.projectId) countsFor(m.projectId).memories++;
  }
  for (const i of instructions) {
    if (i.projectId) countsFor(i.projectId).instructions++;
  }
  for (const s of mcpServers) {
    if (s.projectId) countsFor(s.projectId).mcp++;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your agents and their context."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={<Bot size={18} />}
          label="Agents Detected"
          value={detectedAgents.length}
          accent="accent"
          to="/agents"
        />
        <StatCard
          icon={<Package size={18} />}
          label="Skills"
          value={skills.length}
          accent="success"
          to="/skills"
        />
        <StatCard
          icon={<FolderOpen size={18} />}
          label="Projects"
          value={projectsData?.projects.length || 0}
          accent="success"
          to="/projects"
        />
        <StatCard
          icon={<Cable size={18} />}
          label="MCP Servers"
          value={mcpServers.length}
          accent="warning"
          to="/mcp"
        />
        <StatCard
          icon={<Brain size={18} />}
          label="Memories"
          value={memories.length}
          accent="accent"
          to="/memories"
        />
        <StatCard
          icon={<FileText size={18} />}
          label="Instructions"
          value={instructions.length}
          accent="accent"
          to="/instructions"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-muted mb-3">
            Context by Agent
          </h2>
          <div className="space-y-2">
            {detectedAgents.map((agent) => {
              const memCount = memories.filter(
                (m) => m.toolId === agent.id
              ).length;
              const instCount = instructions.filter(
                (i) => i.toolId === agent.id
              ).length;
              return (
                <Link
                  key={agent.id}
                  to={`/skills?agent=${agent.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-raised hover:border-accent/50 border border-transparent transition-colors"
                >
                  <span className="text-sm font-medium text-ink">
                    {agent.name}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {agent.skillCount} skills · {memCount} memories ·{" "}
                    {instCount} instructions · {agent.mcpCount} MCP
                  </span>
                </Link>
              );
            })}
            {detectedAgents.length === 0 && (
              <p className="text-sm text-ink-dim">No agents detected yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-muted mb-3">
            Context by Project
          </h2>
          <div className="space-y-2">
            {projects.map((project) => {
              const c = countsFor(project.id);
              return (
                <Link
                  key={project.id}
                  to={`/projects/${encodeURIComponent(project.id)}`}
                  className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-raised hover:border-accent/50 border border-transparent transition-colors"
                >
                  <span className="text-sm font-medium text-ink">
                    {project.name}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {c.skills} skills · {c.instructions} AGENTS.md ·{" "}
                    {c.memories} memories · {c.mcp} MCP
                  </span>
                </Link>
              );
            })}
            {projects.length === 0 && (
              <p className="text-sm text-ink-dim">
                No projects yet. Add project directories in{" "}
                <Link to="/settings" className="text-accent hover:underline">
                  Settings
                </Link>
                .
              </p>
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
