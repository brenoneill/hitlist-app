"use client";

import { useRef, useState, type ReactNode } from "react";

export type OverlayPlacement = "bottom" | "end";

const PANEL: Record<OverlayPlacement, string> = {
  bottom:
    "flex max-h-[92dvh] animate-slide-up flex-col overflow-hidden rounded-t-2xl border-t border-edge bg-surface",
  end: "flex h-full w-[min(20rem,88vw)] animate-slide-in-right flex-col border-l border-edge bg-surface shadow-[-12px_0_40px_rgba(0,0,0,0.45)]",
};

const BACKDROP: Record<OverlayPlacement, string> = {
  bottom: "flex flex-col justify-end",
  end: "flex justify-end",
};

const EXIT_TRANSFORM: Record<OverlayPlacement, string> = {
  bottom: "translateY(100%)",
  end: "translateX(100%)",
};

export type OverlayDialogApi = {
  requestClose: () => void;
  bindHandle: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
};

/**
 * Shared modal shell: dimmed scrim, fade, dismiss animation, drag-to-dismiss.
 * @param placement - `bottom` sheet or `end` (right) slideout.
 * @param onClose - Called after the exit animation finishes.
 * @param ariaLabelledBy - Optional `aria-labelledby` id on the dialog.
 * @param panelClassName - Extra classes on the dialog panel.
 * @param children - Render fn receiving `{ requestClose, bindHandle }`.
 */
export function OverlayDialog({
  placement,
  onClose,
  ariaLabelledBy,
  panelClassName = "",
  children,
}: {
  placement: OverlayPlacement;
  onClose: () => void;
  ariaLabelledBy?: string;
  panelClassName?: string;
  children: (api: OverlayDialogApi) => ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);

  function requestClose() {
    if (closing) return;
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 0.28s cubic-bezier(0.4, 0, 0.68, 0.28)";
      el.style.transform = EXIT_TRANSFORM[placement];
    }
    setClosing(true);
  }

  function onHandlePointerDown(e: React.PointerEvent) {
    if (closing) return;
    start.current = placement === "bottom" ? e.clientY : e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = panelRef.current;
    if (el) el.style.transition = "none";
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (start.current == null || closing) return;
    const el = panelRef.current;
    if (!el) return;
    const delta =
      placement === "bottom"
        ? e.clientY - start.current
        : e.clientX - start.current;
    el.style.transform =
      placement === "bottom"
        ? `translateY(${Math.max(0, delta)}px)`
        : `translateX(${Math.max(0, delta)}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    if (start.current == null || closing) return;
    const delta =
      placement === "bottom"
        ? e.clientY - start.current
        : e.clientX - start.current;
    start.current = null;
    if (delta > 80) {
      requestClose();
      return;
    }
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 0.2s ease-out";
      el.style.transform = "";
    }
  }

  const bindHandle = {
    onPointerDown: onHandlePointerDown,
    onPointerMove: onHandlePointerMove,
    onPointerUp: onHandlePointerUp,
    onPointerCancel: onHandlePointerUp,
  };

  return (
    <div
      className={`fixed inset-0 z-40 bg-black/60 ${BACKDROP[placement]} ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        className={[PANEL[placement], panelClassName].filter(Boolean).join(" ")}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={(e) => {
          if (!closing) return;
          if (e.target !== e.currentTarget) return;
          if (e.propertyName !== "transform") return;
          onClose();
        }}
      >
        {children({ requestClose, bindHandle })}
      </div>
    </div>
  );
}
