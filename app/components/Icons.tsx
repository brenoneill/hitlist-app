/** The signature glowing red action button; call sites append their layout classes. */
export const BLOOD_BUTTON =
  "rounded-xl bg-blood py-3 font-mono text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(220,38,38,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none";

export type IconName =
  | "crosshair"
  | "check"
  | "x"
  | "trash"
  | "chevron"
  | "external"
  | "key"
  | "github"
  | "settings"
  | "list"
  | "pr"
  | "merge"
  | "ellipsis"
  | "image"
  | "film"
  | "ban"
  | "cursor"
  | "copilot"
  | "lock"
  | "filter"
  | "send"
  | "download";

const PATHS: Record<IconName, React.ReactNode> = {
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M4 12l5 5L20 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10L18 6" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  external: <path d="M14 5h5v5M19 5l-8 8M19 13v6H5V5h6" />,
  filter: (
    <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5z" />
  ),
  key: (
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M3 17l5-5 4 4 3-3 6 6" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </>
  ),
  ellipsis: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  pr: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12" />
    </>
  ),
  // GitHub's git-merge shape: trunk with a node top and bottom, side branch
  // curving in from the right — deliberately NOT the pr icon's open arrow.
  merge: (
    <>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M6 7.5v9M6 8c0 2.3 1.9 4 4.2 4h5.3" />
    </>
  ),
  // Cursor's mark: an isometric cube (hexagon outline + Y of inner edges).
  cursor: (
    <>
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
      <path d="M12 12L3 7M12 12l9-5M12 12v10" />
    </>
  ),
  // Copilot-ish goggles: visor with two eye slits.
  copilot: (
    <>
      <rect x="3.5" y="7.5" width="17" height="10" rx="5" />
      <path d="M9 11v3M15 11v3" />
    </>
  ),
  send: <path d="M12 19V5M5 12l7-7 7 7" />,
  download: <path d="M12 4v11M6.5 10.5L12 16l5.5-5.5M4 19h16" />,
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.55-3.87-1.55-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.02 1.77 2.68 1.26 3.34.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.29-5.23-5.74 0-1.27.45-2.3 1.19-3.12-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.17 1.19a10.9 10.9 0 0 1 5.78 0c2.2-1.5 3.17-1.19 3.17-1.19.63 1.6.23 2.78.11 3.07.74.81 1.19 1.85 1.19 3.12 0 4.46-2.69 5.44-5.25 5.73.41.36.77 1.05.77 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55A11.53 11.53 0 0 0 23.5 12.03C23.5 5.66 18.35.5 12 .5z"
    />
  ),
};

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

