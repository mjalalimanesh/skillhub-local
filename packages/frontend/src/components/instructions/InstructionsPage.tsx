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
import { FileText, RefreshCw } from "lucide-react";

export default function InstructionsPage() {
  const [filterTool, setFilterTool] = useState<string>("all");
  const [filterScope, setFilterScope] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["instructions"],
    queryFn: () => api.getInstructions(),
    staleTime: Infinity,
  });

  const instructions = data?.instructions || [];

  const tools = [...new Set(instructions.map((i) => i.toolId))];

  const filtered = instructions.filter((i) => {
    if (filterTool !== "all" && i.toolId !== filterTool) return false;
    if (filterScope !== "all" && i.scope !== filterScope) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructions"
        description={`${instructions.length} instruction files from AI tools.`}
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
        <div className="text-ink-dim">Loading instructions...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((instruction) => (
            <Link key={instruction.id} to={`/instructions/${encodeURIComponent(instruction.id)}`}>
              <Card className="flex items-center justify-between px-4 py-3 hover:border-line-strong transition-colors group cursor-pointer">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText size={16} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink group-hover:text-accent transition-colors truncate">
                      {instruction.name}
                    </div>
                    <div className="text-xs text-ink-dim truncate">{instruction.path}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <Badge variant="default">{instruction.toolName}</Badge>
                  <Badge variant={instruction.scope === "global" ? "accent" : "success"}>
                    {instruction.scope}
                  </Badge>
                  {instruction.projectName && (
                    <span className="text-xs text-ink-dim">{instruction.projectName}</span>
                  )}
                  {instruction.hasFrontmatter && (
                    <Badge variant="default">frontmatter</Badge>
                  )}
                  <span className="text-xs text-ink-dim">
                    {(instruction.size / 1024).toFixed(1)}KB
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-dim">
              No instruction files found. Configure project directories in Settings to scan for project-scoped instructions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
