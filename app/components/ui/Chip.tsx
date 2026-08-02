import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/app/components/Icons";

export type ChipVariant = "default" | "muted" | "info" | "surface";

const VARIANT: Record<ChipVariant, string> = {
  default:
    "rounded-full border border-edge bg-background px-3 py-1 font-mono text-xs",
  surface:
    "rounded-full border border-edge bg-surface px-3 py-1 font-mono text-xs",
  muted:
    "rounded-full border border-edge bg-background px-3 py-1 font-mono text-xs text-muted active:opacity-80 disabled:opacity-40",
  info: "rounded-full border border-info/40 bg-info/10 px-3 py-1 font-mono text-xs text-info transition-colors active:bg-info/20",
};

type Props = {
  icon?: IconName;
  iconClassName?: string;
  variant?: ChipVariant;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * Pill chip with optional leading icon and dismiss control.
 * Renders a `<button>` when `onClick` is set; otherwise a `<span>`.
 * @param variant - Visual style (`default`, `surface`, `muted`, `info`).
 * @param onDismiss - Shows an X control that calls this handler.
 * @param dismissLabel - Accessible label for the dismiss control.
 */
export function Chip({
  icon,
  iconClassName,
  variant = "default",
  onDismiss,
  dismissLabel = "Remove",
  className = "",
  children,
  onClick,
  type = "button",
  ...buttonProps
}: Props) {
  const classes = [
    "inline-flex items-center gap-1.5 self-start",
    VARIANT[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {icon && (
        <Icon
          name={icon}
          className={iconClassName ?? (variant === "default" || variant === "surface" ? "size-3 text-blood" : "size-3")}
        />
      )}
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={dismissLabel}
          className="inline-flex"
        >
          <Icon name="x" className="size-3 text-muted" />
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type={type}
        onClick={onClick}
        className={classes}
        {...buttonProps}
      >
        {body}
      </button>
    );
  }

  return <span className={classes}>{body}</span>;
}
