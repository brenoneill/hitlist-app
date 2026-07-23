import type { SVGProps } from "react";

/**
 * Note icon used as the extra-context affordance on normal list items.
 * @param props - Standard SVG props; size/color via `className` and `currentColor`.
 */
export function NoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3.5 1.75h6.3L12.5 4.45v9.8a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75v-11.5a.75.75 0 0 1 .75-.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 1.75v2.7h2.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.25 8h5.5M5.25 10.75h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
