import { NavLink } from "react-router-dom";
import { LayoutDashboard, Bot, Package, Table2, Store, Puzzle, Settings, Wifi, WifiOff } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/skills", icon: Package, label: "Skills" },
  { to: "/matrix", icon: Table2, label: "Matrix" },
  { to: "/store", icon: Store, label: "Store" },
  { to: "/plugins", icon: Puzzle, label: "Plugins" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const wsConnected = useAppStore((s) => s.wsConnected);

  return (
    <aside className="w-56 h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-text">SkillHub Local</h1>
        <div className="flex items-center gap-1.5 mt-1">
          {wsConnected ? (
            <>
              <Wifi size={12} className="text-success" />
              <span className="text-xs text-success">Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-danger" />
              <span className="text-xs text-danger">Disconnected</span>
            </>
          )}
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary/20 text-primary-hover"
                  : "text-text-muted hover:bg-surface-alt hover:text-text"
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border text-xs text-text-dim">
        v0.1.0
      </div>
    </aside>
  );
}
