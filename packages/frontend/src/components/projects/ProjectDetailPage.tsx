import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Package,
  FileText,
  Brain,
  Cable,
  FolderOpen,
  RefreshCw,
  Puzzle,
} from "lucide-react";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const decodedId = decodeURIComponent(projectId || "");
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

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

  const project = (projectsData?.projects || []).find((p) => p.id === decodedId);

  // Skills are per-agent entries; several agents can share the same physical
  // directory (.agents/skills), so collapse identical paths into one row.
  const projectSkills = (skillsData?.skills || []).filter(
    (s) => s.scope === "project" && s.projectId === decodedId
  );
  const skillRows = new Map<
    string,
    { name: string; path: string; description: string; hasPlugin: boolean; agentIds: string[] }
  >();
  for (const s of projectSkills) {
    const key = `${s.name}|${s.path}`;
    const row = skillRows.get(key);
    if (row) {
      if (!row.agentIds.includes(s.agentId)) row.agentIds.push(s.agentId);
    } else {
      skillRows.set(key, {
        name: s.pluginName ? s.name.split(":").slice(1).join(":") : s.name,
        path: s.path,
        description: s.description,
        hasPlugin: !!s.pluginId,
        agentIds: [s.agentId],
      });
    }
  }

  const instructions = (instructionsData?.instructions || []).filter(
    (i) => i.projectId === decodedId
  );
  const memories = (memoriesData?.memories || []).filter(
    (m) => m.projectId === decodedId
  );
  const servers = (mcpData?.servers || []).filter(
    (s) => s.projectId === decodedId
  );

  const projectName =
    project?.name ||
    instructions[0]?.projectName ||
    memories[0]?.projectName ||
    servers[0]?.projectName ||
    projectSkills[0]?.projectName ||
    decodedId;

  const rescan = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["skills"] });
    queryClient.invalidateQueries({ queryKey: ["memories"] });
    queryClient.invalidateQueries({ queryKey: ["instructions"] });
    queryClient.invalidateQueries({ queryKey: ["mcp"] });
  };

  const totalItems =
    skillRows.size + instructions.length + memories.length + servers.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={projectName}
        description={project?.path}
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: projectName }]}
        actions={
          <Button variant="secondary" size="sm" onClick={rescan}>
            <RefreshCw size={14} />
            Re-scan
          </Button>
        }
      />

      {projectsLoading ? (
        <div className="text-ink-dim">Loading project...</div>
      ) : !project && totalItems === 0 ? (
        <div className="flex items-center gap-3">
          <FolderOpen size={16} className="text-ink-dim shrink-0" />
          <p className="text-sm text-ink-dim">
            No project with this ID was found. It may have been removed or renamed —{" "}
            <Link to="/projects" className="text-accent hover:underline">
              back to Projects
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {skillRows.size > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-muted flex items-center gap-2">
                <Package size={13} />
                Skills
                <Badge variant="default" className="text-xs">{skillRows.size}</Badge>
              </h2>
              {[...skillRows.values()].map((row) => (
                <Link
                  key={`${row.path}`}
                  to={`/skills/${encodeURIComponent(row.name)}?project=${encodeURIComponent(decodedId)}`}
                  className="block"
                >
                  <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {row.hasPlugin ? (
                        <Puzzle size={16} className="text-purple-500 shrink-0" />
                      ) : (
                        <Package size={16} className="text-accent shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                          {row.name}
                        </div>
                        <div className="text-xs text-ink-dim truncate">{row.path}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 shrink-0 flex-wrap justify-end">
                      {row.agentIds.map((id) => (
                        <Badge key={id} variant="default">{id}</Badge>
                      ))}
                    </div>
                  </Card>
                </Link>
              ))}
            </section>
          )}

          {instructions.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-muted flex items-center gap-2">
                <FileText size={13} />
                AGENTS.md &amp; instructions
                <Badge variant="default" className="text-xs">{instructions.length}</Badge>
              </h2>
              {instructions.map((i) => (
                <Link
                  key={i.id}
                  to={`/instructions/${encodeURIComponent(i.id)}`}
                  className="block"
                >
                  <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText size={16} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                          {i.name}
                        </div>
                        <div className="text-xs text-ink-dim truncate">{i.path}</div>
                      </div>
                    </div>
                    <Badge variant="default">{i.toolName}</Badge>
                  </Card>
                </Link>
              ))}
            </section>
          )}

          {memories.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-muted flex items-center gap-2">
                <Brain size={13} />
                Memories
                <Badge variant="default" className="text-xs">{memories.length}</Badge>
              </h2>
              {memories.map((m) => (
                <Link
                  key={m.id}
                  to={`/memories/${encodeURIComponent(m.id)}`}
                  className="block"
                >
                  <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Brain size={16} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                          {m.name}
                        </div>
                        <div className="text-xs text-ink-dim truncate">{m.path}</div>
                      </div>
                    </div>
                    <Badge variant="default">{m.toolName}</Badge>
                  </Card>
                </Link>
              ))}
            </section>
          )}

          {servers.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-muted flex items-center gap-2">
                <Cable size={13} />
                MCP Servers
                <Badge variant="default" className="text-xs">{servers.length}</Badge>
              </h2>
              {servers.map((s) => (
                <Link
                  key={s.id}
                  to={`/mcp/${encodeURIComponent(s.id)}`}
                  className="block"
                >
                  <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Cable size={16} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                          {s.name}
                        </div>
                        <div className="text-xs text-ink-dim truncate">{s.sourceFile}</div>
                      </div>
                    </div>
                    <Badge variant="default">{s.agentName || s.agentId}</Badge>
                  </Card>
                </Link>
              ))}
            </section>
          )}

          {totalItems === 0 && (
            <div className="text-center py-12 text-ink-dim">
              No project-scoped skills, AGENTS.md files, memories or MCP servers found in this project yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}
