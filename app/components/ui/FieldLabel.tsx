import type { HTMLAttributes, ReactNode } from "react";

const BASE =
  "font-mono text-[11px] uppercase tracking-widest text-muted";

/**
 * Mono uppercase field / section label.
 * @param children - Label text.
 * @param as - Element tag (default `p`).
 * @param className - Extra layout classes (e.g. `mb-2`).
 */
export function FieldLabel({
  children,
  as: Tag = "p",
  className = "",
  ...props
}: {
  children: ReactNode;
  as?: "p" | "span" | "h2" | "h3" | "label";
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={[BASE, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Tag>
  );
}
