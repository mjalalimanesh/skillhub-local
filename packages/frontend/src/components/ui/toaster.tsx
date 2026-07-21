import { create } from "zustand";
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "loading";
  title: string;
  description?: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    if (toast.type !== "loading" && (toast.duration ?? 4000) > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, toast.duration ?? 4000);
    }
    return id;
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const styles = {
  success: "text-success",
  error: "text-danger",
  info: "text-ink-muted",
  loading: "text-accent",
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-3 shadow-lg animate-in slide-in-from-right-full fade-in-0 duration-300"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                styles[toast.type],
                toast.type === "loading" && "animate-spin"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-ink-muted mt-0.5">
                  {toast.description}
                </p>
              )}
            </div>
            {toast.type !== "loading" && (
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-ink-dim hover:text-ink transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
