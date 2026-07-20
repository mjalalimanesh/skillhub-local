import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useWebSocket } from "@/hooks/useWebSocket";

export function Layout() {
  useWebSocket();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-56 p-6">
        <Outlet />
      </main>
    </div>
  );
}
