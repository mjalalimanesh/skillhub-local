import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Folder, Globe, RefreshCw, Info } from "lucide-react";

const GLOBAL_KEY = "__global__";

export default function InstructionsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["instructions"],
    queryFn: () => api.getInstructions(),
    staleTime: Infinity,
  });

  const instructions = data?.instructions || [];

  const byProject = new Map<string, { projectName: string; instructions: typeof instructions }>();
  for (const i of instructions) {
    const key = i.projectId || GLOBAL_KEY;
    const name = i.projectName || "Global";
    const existing = byProject.get(key);
    if (existing) {
      existing.instructions.push(i);
    } else {
      byProject.set(key, { projectName: name, instructions: [i] });
    }
  }

  const projects = [...byProject.entries()].sort((a, b) => {
    if (a[0] === GLOBAL_KEY) return -1;
    if (b[0] === GLOBAL_KEY) return 1;
    return a[1].projectName.localeCompare(b[1].projectName);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructions"
        description={`${instructions.length} instruction files from ${projects.length} projects.`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["instructions"] })}
          >
            <RefreshCw size={14} />
            Re-scan
          </Button>
        }
      />

      <Card className="flex items-center gap-3 px-4 py-3 bg-accent/5 border-accent/20">
        <Info size={16} className="text-accent shrink-0" />
        <p className="text-sm text-ink-muted">
          Project-scoped instructions are discovered from directories configured in{" "}
          <Link to="/settings" className="text-accent hover:underline font-medium">
            Settings
          </Link>
          . Add your project directories there to see them listed here.
        </p>
      </Card>

      {isLoading ? (
        <div className="text-ink-dim">Loading instructions...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-ink-dim">
          No instruction files found. Configure project directories in Settings to scan for project-scoped instructions.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map(([projectId, { projectName, instructions: items }]) => {
            const isGlobal = projectId === GLOBAL_KEY;
            return (
              <Link
                key={projectId}
                to={`/instructions/project/${encodeURIComponent(projectId)}`}
                className="block"
              >
                <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isGlobal ? (
                      <Globe size={16} className="text-accent shrink-0" />
                    ) : (
                      <Folder size={16} className="text-accent shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                        {projectName}
                      </div>
                      {!isGlobal && (
                        <div className="text-xs text-ink-dim truncate">{projectId}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    {isGlobal && (
                      <Badge variant="accent">Global</Badge>
                    )}
                    <Badge variant="default">
                      {items.length} {items.length === 1 ? "instruction" : "instructions"}
                    </Badge>
                    {items.some((i) => i.hasFrontmatter) && (
                      <Badge variant="default">frontmatter</Badge>
                    )}
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
