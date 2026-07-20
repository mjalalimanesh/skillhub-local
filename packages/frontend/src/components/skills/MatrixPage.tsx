import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Copy, Check } from "lucide-react";
import { CopyToAgentsDialog } from "./CopyToAgentsDialog";

export default function MatrixPage() {
  const [copySkill, setCopySkill] = useState<{ path: string; name: string; agent: string } | null>(null);
  const queryClient = useQueryClient();

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

  // Build unique skill names
  const skillNames = [...new Set(skills.map((s) => s.name))].sort();

  // Build lookup: skillName -> Set<agentId>
  const matrix = new Map<string, Set<string>>();
  for (const skill of skills) {
    if (!matrix.has(skill.name)) matrix.set(skill.name, new Set());
    matrix.get(skill.name)!.add(skill.agentId);
  }

  // Build lookup: skillName -> first skill entry (for path)
  const skillPaths = new Map<string, string>();
  for (const skill of skills) {
    if (!skillPaths.has(skill.name)) skillPaths.set(skill.name, skill.path);
  }

  // Build lookup: skillName -> first agentId that has it
  const skillSourceAgent = new Map<string, string>();
  for (const skill of skills) {
    if (!skillSourceAgent.has(skill.name)) skillSourceAgent.set(skill.name, skill.agentId);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agent Matrix</h1>
      <p className="text-sm text-text-muted">
        Cross-reference of skills across all detected agents. Click the copy icon to distribute a skill to other agents.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-sm font-medium text-text-muted px-4 py-3 border-b border-border sticky left-0 bg-bg">
                Skill
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.id}
                  className="text-center text-xs font-medium text-text-muted px-4 py-3 border-b border-border min-w-[100px]"
                >
                  {agent.name}
                </th>
              ))}
              <th className="px-4 py-3 border-b border-border w-10"></th>
            </tr>
          </thead>
          <tbody>
            {skillNames.map((skillName) => {
              const installedIn = matrix.get(skillName) || new Set();
              const missingCount = agents.filter((a) => !installedIn.has(a.id)).length;
              const sourceAgent = skillSourceAgent.get(skillName) || "";
              const skillPath = skillPaths.get(skillName) || "";

              return (
                <tr key={skillName} className="hover:bg-surface-alt/50">
                  <td className="text-sm px-4 py-2.5 border-b border-border/50 sticky left-0 bg-bg">
                    {skillName}
                  </td>
                  {agents.map((agent) => {
                    const installed = installedIn.has(agent.id);
                    return (
                      <td
                        key={agent.id}
                        className="text-center px-4 py-2.5 border-b border-border/50"
                      >
                        {installed ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-success/20 text-success text-xs leading-5">
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-5 h-5 rounded-full bg-surface-alt text-text-dim text-xs leading-5">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 border-b border-border/50">
                    {missingCount > 0 && (
                      <button
                        className="p-1 rounded hover:bg-surface-alt text-text-dim hover:text-primary transition-colors"
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
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {skillNames.length === 0 && (
              <tr>
                <td
                  colSpan={agents.length + 2}
                  className="text-center py-12 text-text-dim"
                >
                  No skills installed across any agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
