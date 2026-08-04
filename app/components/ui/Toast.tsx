"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/app/components/Icons";

export const TOAST_SHELL =
  "fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4";
export const TOAST_PILL =
  "flex items-center gap-2 rounded-xl border border-edge bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest shadow-lg shadow-black/50";

type ToastTone = "deploy" | "error" | "ok";

type ToastOpts = {
  /** When true, stays until cleared or replaced (no auto-dismiss). */
  sticky?: boolean;
  /** Auto-dismiss after ms; ignored when sticky. Default 6000. */
  ms?: number;
  /** Icon / color treatment. Default deploy. */
  tone?: ToastTone;
};

type ToastEntry = { message: string; tone: ToastTone };

type ToastContextValue = {
  toast: ToastEntry | null;
  showToast: (message: string, opts?: ToastOpts) => void;
  clearToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON = {
  deploy: { name: "crosshair" as const, cls: "text-warn" },
  error: { name: "x" as const, cls: "text-blood" },
  ok: { name: "check" as const, cls: "text-ok" },
};

/**
 * App-wide toast tray (same chrome as the list Undo pill). Mount once under
 * Providers so messages survive route changes.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  /**
   * Shows a bottom toast. Sticky toasts stay until `clearToast` / a replacement.
   * @param message - Short status or error text.
   * @param opts - sticky / dismiss timing / tone.
   */
  const showToast = useCallback((message: string, opts?: ToastOpts) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast({ message, tone: opts?.tone ?? "deploy" });
    if (opts?.sticky) return;
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null;
        setToast(null);
      },
      opts?.ms ?? 6000,
    );
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const icon = toast ? TONE_ICON[toast.tone] : null;

  return (
    <ToastContext.Provider value={{ toast, showToast, clearToast }}>
      {children}
      {toast && icon && (
        <div className={TOAST_SHELL}>
          <div role="status" aria-live="polite" className={TOAST_PILL}>
            <Icon
              name={icon.name}
              className={`size-3.5 shrink-0 ${icon.cls}`}
            />
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

/**
 * Access the global toast tray.
 * @returns showToast / clearToast / current toast message.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
