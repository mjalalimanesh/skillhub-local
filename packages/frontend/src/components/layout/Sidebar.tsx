import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Package,
  Table2,
  Store,
  Puzzle,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAppStore } from "@/stores/app";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/matrix", icon: Table2, label: "Matrix" },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/skills", icon: Package, label: "Skills" },
      { to: "/agents", icon: Bot, label: "Agents" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/store", icon: Store, label: "Store" },
      { to: "/plugins", icon: Puzzle, label: "Plugins" },
      { to: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const wsConnected = useAppStore((s) => s.wsConnected);

  return (
    <aside className="w-56 h-screen bg-surface border-r border-line flex flex-col fixed left-0 top-0">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-base font-bold text-ink tracking-tight">
          SkillHub Local
        </h1>
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm transition-colors relative",
                      isActive
                        ? "bg-raised text-ink font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-4 before:w-0.5 before:rounded-full before:bg-accent"
                        : "text-ink-muted hover:text-ink hover:bg-raised/50"
                    )
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-line flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {wsConnected ? (
            <Wifi size={12} className="text-success" />
          ) : (
            <WifiOff size={12} className="text-danger" />
          )}
          <span
            className={cn(
              "text-[11px]",
              wsConnected ? "text-success" : "text-danger"
            )}
          >
            {wsConnected ? "Live" : "Offline"}
          </span>
        </div>
        <span className="text-[11px] text-ink-dim">v0.1.0</span>
      </div>
    </aside>
  );
}
