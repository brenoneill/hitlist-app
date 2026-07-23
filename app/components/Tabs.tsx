"use client";

import { Icon, type IconName } from "@/app/components/Icons";

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon: IconName }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="mb-6 flex gap-1 rounded-xl border border-edge bg-surface p-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-xs font-bold uppercase tracking-widest transition-colors ${
              isActive
                ? "bg-blood text-white shadow-[0_0_16px_rgba(220,38,38,0.4)]"
                : "text-muted active:bg-background"
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
