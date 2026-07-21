import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import DashboardPage from "./components/dashboard/DashboardPage";
import AgentsPage from "./components/agents/AgentsPage";
import SkillsPage from "./components/skills/SkillsPage";
import SkillDetailPage from "./components/skills/SkillDetailPage";
import MatrixPage from "./components/skills/MatrixPage";
import StorePage from "./components/store/StorePage";
import PluginsPage from "./components/plugins/PluginsPage";
import SettingsPage from "./components/settings/SettingsPage";
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
        <Route path="/skills/:skillName" element={<SkillDetailPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/matrix" element={<MatrixPage />} />
        <Route path="/store" element={<StorePage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
