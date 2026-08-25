import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import DashboardPage from "./components/dashboard/DashboardPage";
import AgentsPage from "./components/agents/AgentsPage";
import ProjectsPage from "./components/projects/ProjectsPage";
import ProjectDetailPage from "./components/projects/ProjectDetailPage";
import SkillsPage from "./components/skills/SkillsPage";
import SkillDetailPage from "./components/skills/SkillDetailPage";
import MatrixPage from "./components/skills/MatrixPage";
import StorePage from "./components/store/StorePage";
import PluginsPage from "./components/plugins/PluginsPage";
import McpPage from "./components/mcp/McpPage";
import McpDetailPage from "./components/mcp/McpDetailPage";
import SettingsPage from "./components/settings/SettingsPage";
import MemoriesPage from "./components/memories/MemoriesPage";
import AgentMemoriesPage from "./components/memories/AgentMemoriesPage";
import MemoryDetailPage from "./components/memories/MemoryDetailPage";
import InstructionsPage from "./components/instructions/InstructionsPage";
import ProjectInstructionsPage from "./components/instructions/ProjectInstructionsPage";
import InstructionDetailPage from "./components/instructions/InstructionDetailPage";
import TemplatesPage from "./components/templates/TemplatesPage";
import TemplateEditorPage from "./components/templates/TemplateEditorPage";
import { api } from "./lib/api";
import { useAppStore } from "./stores/app";
import { useInitTheme } from "./lib/theme";

export default function App() {
  useInitTheme();
  const setAgents = useAppStore((s) => s.setAgents);

  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  useEffect(() => {
    if (data?.agents) setAgents(data.agents);
  }, [data, setAgents]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/skills/:skillName" element={<SkillDetailPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/matrix" element={<MatrixPage />} />
        <Route path="/memories" element={<MemoriesPage />} />
        <Route path="/memories/agent/:agentId" element={<AgentMemoriesPage />} />
        <Route path="/memories/:memoryId" element={<MemoryDetailPage />} />
        <Route path="/instructions" element={<InstructionsPage />} />
        <Route path="/instructions/project/:projectId" element={<ProjectInstructionsPage />} />
        <Route path="/instructions/:instructionId" element={<InstructionDetailPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/new" element={<TemplateEditorPage />} />
        <Route path="/templates/:templateId/edit" element={<TemplateEditorPage />} />
        <Route path="/store" element={<StorePage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/mcp/:serverId" element={<McpDetailPage />} />
        <Route path="/mcp" element={<McpPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
