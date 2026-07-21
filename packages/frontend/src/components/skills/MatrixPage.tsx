import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyToAgentsDialog } from "./CopyToAgentsDialog";
import { Copy, Check } from "lucide-react";

export default function MatrixPage() {
  const [copySkill, setCopySkill] = useState<{
    path: string;
    name: string;
    agent: string;
  } | null>(null);

  const { data: agentData } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const { data: skillData } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });

  const agents = (agentData?.agents || []).filter((a) => a.detected);
  const skills = skillData?.skills || [];

  const skillNames = [...new Set(skills.map((s) => s.name))].sort();

  const matrix = new Map<string, Set<string>>();
  for (const skill of skills) {
    if (!matrix.has(skill.name)) matrix.set(skill.name, new Set());
    matrix.get(skill.name)!.add(skill.agentId);
  }

  const skillPaths = new Map<string, string>();
  for (const skill of skills) {
    if (!skillPaths.has(skill.name)) skillPaths.set(skill.name, skill.path);
  }

  const skillSourceAgent = new Map<string, string>();
  for (const skill of skills) {
    if (!skillSourceAgent.has(skill.name))
      skillSourceAgent.set(skill.name, skill.agentId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Matrix"
        description="Cross-reference of skills across all detected agents."
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-sm font-medium text-ink-muted px-4 py-3 border-b border-line sticky left-0 bg-surface z-10">
                Skill
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.id}
                  className="text-center text-xs font-medium text-ink-muted px-4 py-3 border-b border-line min-w-[100px] bg-surface"
                >
                  {agent.name}
                </th>
              ))}
              <th className="px-4 py-3 border-b border-line w-10 bg-surface" />
            </tr>
          </thead>
          <tbody>
            {skillNames.map((skillName) => {
              const installedIn = matrix.get(skillName) || new Set();
              const missingCount = agents.filter(
                (a) => !installedIn.has(a.id)
              ).length;
              const sourceAgent = skillSourceAgent.get(skillName) || "";
              const skillPath = skillPaths.get(skillName) || "";

              return (
                <tr
                  key={skillName}
                  className="hover:bg-raised/50 transition-colors"
                >
                  <td className="text-sm px-4 py-2.5 border-b border-line/50 sticky left-0 bg-surface z-10">
                    <Link
                      to={`/skills/${skillName}`}
                      className="text-ink hover:text-accent transition-colors"
                    >
                      {skillName}
                    </Link>
                  </td>
                  {agents.map((agent) => {
                    const installed = installedIn.has(agent.id);
                    return (
                      <td
                        key={agent.id}
                        className="text-center px-4 py-2.5 border-b border-line/50"
                      >
                        {installed ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/15 text-success text-xs">
                            <Check size={12} />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-raised text-ink-dim text-xs">
                            &mdash;
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 border-b border-line/50">
                    {missingCount > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={`Copy to ${missingCount} other agent${missingCount !== 1 ? "s" : ""}`}
                        onClick={() =>
                          setCopySkill({
                            path: skillPath,
                            name: skillName,
                            agent: sourceAgent,
                          })
                        }
                      >
                        <Copy size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {skillNames.length === 0 && (
              <tr>
                <td
                  colSpan={agents.length + 2}
                  className="text-center py-12 text-ink-dim"
                >
                  No skills installed across any agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {copySkill && (
        <CopyToAgentsDialog
          open={!!copySkill}
          onOpenChange={(open) => !open && setCopySkill(null)}
          skillPath={copySkill.path}
          skillName={copySkill.name}
          sourceAgent={copySkill.agent}
        />
      )}
    </div>
  );
}
