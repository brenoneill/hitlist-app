"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/app/components/Icons";

type Indicator = { left: number; width: number };

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon: IconName }[];
  active: T;
  onChange: (id: T) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [ready, setReady] = useState(false);
  const primed = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function measure() {
      const list = listRef.current;
      if (!list) return;
      const btn = list.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!btn) return;
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
      if (!primed.current) {
        primed.current = true;
        requestAnimationFrame(() => setReady(true));
      }
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active, tabs]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className="relative mb-6 flex gap-1 rounded-xl border border-edge bg-surface p-1"
    >
      {indicator && (
        <div
          aria-hidden
          className={`pointer-events-none absolute top-1 bottom-1 left-0 rounded-lg bg-blood shadow-[0_0_16px_rgba(220,38,38,0.4)] motion-reduce:transition-none ${
            ready
              ? "transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              : ""
          }`}
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      )}
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-xs font-bold uppercase tracking-widest transition-colors duration-300 motion-reduce:transition-none ${
              isActive
                ? "text-white"
                : "text-muted active:bg-background/60"
            }`}
          >
            <Icon name={tab.icon} className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
