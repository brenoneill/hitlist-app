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
import { Icon, type IconName } from "@/app/components/Icons";

const TOAST_SHELL =
  "fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4";
const TOAST_PILL =
  "flex items-center gap-2 rounded-xl border border-edge bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest shadow-lg shadow-black/50";

type ToastTone = "deploy" | "error" | "ok";

type ToastAction = {
  /** Invoked when the pill is pressed (e.g. Undo). */
  onClick: () => void;
  /** Optional keyboard hint shown muted, e.g. ⌘Z. */
  hint?: string;
};

type ToastOpts = {
  /** When true, stays until cleared or replaced (no auto-dismiss). */
  sticky?: boolean;
  /** Auto-dismiss after ms; ignored when sticky. Default 6000. */
  ms?: number;
  /** Icon / color treatment. Default deploy. */
  tone?: ToastTone;
  /** When set, the pill is a button — same interaction as Undo move. */
  action?: ToastAction;
};

type ToastEntry = {
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type ToastContextValue = {
  toast: ToastEntry | null;
  showToast: (message: string, opts?: ToastOpts) => void;
  clearToast: () => void;
  /** Hide the tray without clearing (list drag); show again when false. */
  setTrayHidden: (hidden: boolean) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, { name: IconName; cls: string }> = {
  deploy: { name: "crosshair", cls: "text-warn" },
  error: { name: "x", cls: "text-blood" },
  ok: { name: "check", cls: "text-ok" },
};

/**
 * Single bottom toast tray for the app — Undo, errors, and deploy status.
 * Mount once under Providers so messages survive route changes.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  /**
   * Shows the bottom toast pill. Sticky toasts stay until cleared/replaced.
   * @param message - Short status, error, or action label.
   * @param opts - sticky / dismiss timing / tone / optional tap action.
   */
  const showToast = useCallback((message: string, opts?: ToastOpts) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast({
      message,
      tone: opts?.tone ?? "deploy",
      action: opts?.action,
    });
    if (opts?.sticky) return;
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null;
        setToast(null);
      },
      opts?.ms ?? 6000,
    );
  }, []);

  const setTrayHidden = useCallback((next: boolean) => {
    setHidden(next);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const icon = toast ? TONE_ICON[toast.tone] : null;
  const visible = !!toast && !!icon && !hidden;

  return (
    <ToastContext.Provider
      value={{ toast, showToast, clearToast, setTrayHidden }}
    >
      {children}
      {visible && icon && toast && (
        <div className={TOAST_SHELL}>
          {toast.action ? (
            <button
              type="button"
              onClick={toast.action.onClick}
              className={`${TOAST_PILL} active:opacity-80`}
            >
              <Icon
                name={icon.name}
                className={`size-3.5 shrink-0 ${icon.cls}`}
              />
              {toast.message}
              {toast.action.hint && (
                <span className="text-muted">{toast.action.hint}</span>
              )}
            </button>
          ) : (
            <div role="status" aria-live="polite" className={TOAST_PILL}>
              <Icon
                name={icon.name}
                className={`size-3.5 shrink-0 ${icon.cls}`}
              />
              {toast.message}
            </div>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/**
 * Access the shared toast tray (Undo, errors, deploy status).
 * @returns showToast / clearToast / setTrayHidden / current toast.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
