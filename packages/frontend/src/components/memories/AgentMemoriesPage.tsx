import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MemoryFile } from "@/lib/types";
import { Brain, ChevronRight, FolderOpen, RefreshCw } from "lucide-react";

function MemoryRow({ memory }: { memory: MemoryFile }) {
  return (
    <Link to={`/memories/${encodeURIComponent(memory.id)}`} className="block">
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
          {memory.readOnly && <Badge variant="warning">read-only</Badge>}
          <span className="text-xs text-ink-dim">{(memory.size / 1024).toFixed(1)}KB</span>
        </div>
      </Card>
    </Link>
  );
}

function ProjectGroup({ name, root, items }: { name: string; root?: string; items: MemoryFile[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left cursor-pointer"
      >
        <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            <FolderOpen size={16} className="text-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink truncate">{name}</div>
              {root && <div className="text-xs text-ink-dim truncate">{root}</div>}
            </div>
          </div>
          <Badge variant="default">{items.length}</Badge>
        </Card>
      </button>
      {open && (
        <div className="space-y-2 pl-6">
          {items.map((m) => (
            <MemoryRow key={m.id} memory={m} />
          ))}
        </div>
      )}
    </div>
  );
}

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

  const globalMemories = memories.filter((m) => m.scope === "global");
  const projectGroups = [
    ...memories
      .filter((m) => m.scope === "project")
      .reduce((map, m) => {
        const key = m.projectId || m.projectName || m.path;
        const g = map.get(key) || { name: m.projectName || key, root: m.projectRoot, items: [] as MemoryFile[] };
        g.items.push(m);
        return map.set(key, g);
      }, new Map<string, { name: string; root?: string; items: MemoryFile[] }>())
      .values(),
  ].sort((x, y) => x.name.localeCompare(y.name));

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

      {isLoading ? (
        <div className="text-ink-dim">Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 text-ink-dim">
          No memory files found for {agentName}.
        </div>
      ) : (
        <>
          {globalMemories.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-muted flex items-center gap-2">
                Global
                <Badge variant="accent" className="text-xs">{globalMemories.length}</Badge>
              </h2>
              {globalMemories.map((m) => (
                <MemoryRow key={m.id} memory={m} />
              ))}
            </section>
          )}
          {projectGroups.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-muted flex items-center gap-2">
                Projects
                <Badge variant="success" className="text-xs">{projectGroups.length}</Badge>
              </h2>
              {projectGroups.map((g) => (
                <ProjectGroup key={g.name + (g.root || "")} name={g.name} root={g.root} items={g.items} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
