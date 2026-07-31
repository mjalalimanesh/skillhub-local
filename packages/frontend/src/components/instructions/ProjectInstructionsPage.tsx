import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, RefreshCw } from "lucide-react";
import type { InstructionFile } from "@/lib/types";

const GLOBAL_KEY = "__global__";

export default function ProjectInstructionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const decodedId = decodeURIComponent(projectId || "");
  const isGlobal = decodedId === GLOBAL_KEY;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["instructions"],
    queryFn: () => api.getInstructions(),
    staleTime: Infinity,
  });

  const allInstructions = data?.instructions || [];
  const instructions = isGlobal
    ? allInstructions.filter((i) => i.scope === "global")
    : allInstructions.filter((i) => i.projectId === decodedId);

  const projectName = isGlobal
    ? "Global"
    : instructions[0]?.projectName || decodedId;

  const tools = [...new Set(instructions.map((i) => i.toolName))];

  return (
    <div className="space-y-6">
      <PageHeader
        title={projectName}
        description={`${instructions.length} instruction files${isGlobal ? " (global scope)" : ` from ${projectName}`}.`}
        breadcrumbs={[
          { label: "Instructions", href: "/instructions" },
          { label: projectName },
        ]}
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

      {tools.length > 1 && (
        <div className="flex items-center gap-2">
          {tools.map((t) => (
            <Badge key={t} variant="default">
              {t}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-dim">Loading instructions...</div>
      ) : instructions.length === 0 ? (
        <div className="text-center py-12 text-ink-dim">
          No instruction files found for {projectName}.
        </div>
      ) : (
        <div className="space-y-2">
          {instructions.map((instruction) => (
            <InstructionRow key={instruction.id} instruction={instruction} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstructionRow({ instruction }: { instruction: InstructionFile }) {
  return (
    <a href={`/instructions/${encodeURIComponent(instruction.id)}`}>
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
          {instruction.hasFrontmatter && (
            <Badge variant="default">frontmatter</Badge>
          )}
          <span className="text-xs text-ink-dim">
            {(instruction.size / 1024).toFixed(1)}KB
          </span>
        </div>
      </Card>
    </a>
  );
}
