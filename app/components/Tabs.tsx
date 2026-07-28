"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/app/components/Icons";

type Indicator = { left: number; width: number };
type Dir = "left" | "right";

type TabContextValue = {
  active: string;
  dir: Dir;
};

const TabContext = createContext<TabContextValue | null>(null);

/**
 * Segmented control with a sliding pill, plus directional panel transitions.
 * Pass `TabPanel` children for each tab id; panels animate based on tab order.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: { id: T; label: string; icon: IconName }[];
  active: T;
  onChange: (id: T) => void;
  children?: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [ready, setReady] = useState(false);
  const [dir, setDir] = useState<Dir>("right");
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

  function select(id: T) {
    if (id === active) return;
    const from = tabs.findIndex((t) => t.id === active);
    const to = tabs.findIndex((t) => t.id === id);
    if (from >= 0 && to >= 0) setDir(to > from ? "right" : "left");
    onChange(id);
  }

  return (
    <TabContext.Provider value={{ active, dir }}>
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
              onClick={() => select(tab.id)}
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
      {children}
    </TabContext.Provider>
  );
}

/**
 * Renders only when its `id` matches the active tab, sliding in from the
 * navigation direction tracked by the parent `Tabs`.
 */
export function TabPanel({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const ctx = useContext(TabContext);
  if (!ctx || ctx.active !== id) return null;

  return (
    <div
      key={id}
      role="tabpanel"
      className={
        ctx.dir === "right" ? "animate-tab-in-right" : "animate-tab-in-left"
      }
    >
      {children}
    </div>
  );
}
