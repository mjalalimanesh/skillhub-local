import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, RefreshCw } from "lucide-react";

export default function MemoriesPage() {
  const [filterTool, setFilterTool] = useState<string>("all");
  const [filterScope, setFilterScope] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => api.getMemories(),
    staleTime: Infinity,
  });

  const memories = data?.memories || [];

  const tools = [...new Set(memories.map((m) => m.toolId))];

  const filtered = memories.filter((m) => {
    if (filterTool !== "all" && m.toolId !== filterTool) return false;
    if (filterScope !== "all" && m.scope !== filterScope) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memories"
        description={`${memories.length} memory files from AI tools.`}
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

      <div className="flex items-center gap-3">
        <Select value={filterTool} onValueChange={setFilterTool}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Tools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tools</SelectItem>
            {tools.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterScope} onValueChange={setFilterScope}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Scopes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scopes</SelectItem>
            <SelectItem value="global">Global</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-ink-dim">Loading memories...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((memory) => (
            <Link key={memory.id} to={`/memories/${encodeURIComponent(memory.id)}`}>
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
                  <Badge variant="default">{memory.toolName}</Badge>
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
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-dim">
              No memory files found. Configure project directories in Settings to scan for project-scoped memories.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
