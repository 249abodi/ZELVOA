"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icons";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, description?: string) => void;
  toastSuccess: (title: string, description?: string) => void;
  toastError: (title: string, description?: string) => void;
  toastInfo: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastType, { icon: IconName; cls: string }> = {
  success: { icon: "check", cls: "text-success" },
  error: { icon: "alert-circle", cls: "text-destructive" },
  info: { icon: "info", cls: "text-secondary-600 dark:text-secondary-400" },
  warning: { icon: "alert", cls: "text-warning" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, description?: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const api: ToastContextValue = {
    toast,
    toastSuccess: (t, d) => toast("success", t, d),
    toastError: (t, d) => toast("error", t, d),
    toastInfo: (t, d) => toast("info", t, d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[80] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-md animate-in slide-in-from-bottom-2 fade-in"
          >
            <Icon
              name={toastStyles[t.type].icon}
              size={18}
              className={cn("mt-0.5", toastStyles[t.type].cls)}
            />
            <div className="grid flex-1 gap-0.5">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}