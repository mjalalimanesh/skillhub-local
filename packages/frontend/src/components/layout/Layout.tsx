import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Toaster } from "@/components/ui/toaster";

export function Layout() {
  useWebSocket();
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <div
          key={location.pathname}
          className="max-w-6xl mx-auto px-8 py-8 animate-in fade-in duration-200"
        >
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}
