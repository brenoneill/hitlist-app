import type { HTMLAttributes, ReactNode } from "react";

/**
 * Inline form / action error message in blood mono style.
 * @param children - Error message content.
 * @param as - Element tag (default `p`).
 * @param className - Extra layout classes (e.g. `mb-3`, `mt-2`).
 */
export function ErrorText({
  children,
  as: Tag = "p",
  className = "",
  ...props
}: {
  children: ReactNode;
  as?: "p" | "span";
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag
      className={["font-mono text-xs text-blood", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </Tag>
  );
}
