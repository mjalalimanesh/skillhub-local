import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FolderOpen, Info } from "lucide-react";

interface ProjectCounts {
  skills: number;
  memories: number;
  instructions: number;
  mcp: number;
}

export default function ProjectsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  // Reuse the shared caches so counts stay consistent with the other pages.
  const { data: skillsData } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });
  const { data: memoriesData } = useQuery({
    queryKey: ["memories"],
    queryFn: () => api.getMemories(),
  });
  const { data: instructionsData } = useQuery({
    queryKey: ["instructions"],
    queryFn: () => api.getInstructions(),
  });
  const { data: mcpData } = useQuery({
    queryKey: ["mcp"],
    queryFn: () => api.getMcpServers(),
  });

  const projects = data?.projects || [];

  const countsByProject = new Map<string, ProjectCounts>();
  const skillKeysByProject = new Map<string, Set<string>>();
  const countsFor = (projectId: string): ProjectCounts => {
    let c = countsByProject.get(projectId);
    if (!c) {
      c = { skills: 0, memories: 0, instructions: 0, mcp: 0 };
      countsByProject.set(projectId, c);
    }
    return c;
  };

  // Unique physical skills — shared dirs (.agents/skills) are attributed to
  // many agents but must count once per project.
  for (const s of skillsData?.skills || []) {
    if (s.scope === "project" && s.projectId) {
      let set = skillKeysByProject.get(s.projectId);
      if (!set) {
        set = new Set();
        skillKeysByProject.set(s.projectId, set);
      }
      set.add(`${s.name}|${s.path}`);
    }
  }
  for (const [projectId, set] of skillKeysByProject) {
    countsFor(projectId).skills = set.size;
  }
  for (const m of memoriesData?.memories || []) {
    if (m.projectId) countsFor(m.projectId).memories++;
  }
  for (const i of instructionsData?.instructions || []) {
    if (i.projectId) countsFor(i.projectId).instructions++;
  }
  for (const s of mcpData?.servers || []) {
    if (s.projectId) countsFor(s.projectId).mcp++;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${projects.length} ${projects.length === 1 ? "project" : "projects"} discovered from your configured directories.`}
      />

      {projects.length === 0 && (
        <Card className="flex items-center gap-3 px-4 py-3 bg-accent/5 border-accent/20">
          <Info size={16} className="text-accent shrink-0" />
          <p className="text-sm text-ink-muted">
            Add your project root folders in{" "}
            <Link to="/settings" className="text-accent hover:underline font-medium">
              Settings
            </Link>
            . Each immediate subdirectory is treated as a project, and its skills,
            AGENTS.md files, memories and MCP servers are shown here.
          </p>
        </Card>
      )}

      {isLoading ? (
        <div className="text-ink-dim">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-ink-dim">
          No projects found yet.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => {
            const c =
              countsByProject.get(project.id) ||
              ({ skills: 0, memories: 0, instructions: 0, mcp: 0 } as ProjectCounts);
            return (
              <Link
                key={project.id}
                to={`/projects/${encodeURIComponent(project.id)}`}
                className="block"
              >
                <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FolderOpen size={16} className="text-accent shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                        {project.name}
                      </div>
                      <div className="text-xs text-ink-dim truncate">{project.path}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant="default">{c.skills} skills</Badge>
                    <Badge variant="default">{c.instructions} AGENTS.md</Badge>
                    <Badge variant="default">{c.memories} memories</Badge>
                    <Badge variant="default">{c.mcp} MCP</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
