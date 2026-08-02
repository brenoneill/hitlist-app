"use client";

import { type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { BLOOD_BUTTON } from "@/app/components/Icons";

export type ButtonVariant = "blood" | "ghost" | "outline" | "ok" | "info";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  blood: BLOOD_BUTTON,
  ghost: "text-muted underline underline-offset-4",
  outline:
    "rounded-xl border border-edge py-3 font-mono text-sm font-bold uppercase tracking-widest text-foreground active:opacity-80 disabled:opacity-40",
  ok: "rounded-xl bg-ok py-3 font-mono text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_16px_rgba(34,197,94,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none",
  info: "rounded-xl bg-info py-3 font-mono text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(59,130,246,0.4)] active:opacity-80 disabled:opacity-40 disabled:shadow-none",
};

type Common = {
  variant?: ButtonVariant;
  className?: string;
  children?: React.ReactNode;
};

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type AsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

/**
 * Shared action control.
 *
 * - `blood` — glowing red primary CTA
 * - `ghost` — text-link style
 * - `outline` — bordered secondary CTA
 * - `ok` / `info` — status-colored glow CTAs (e.g. merged / open PR)
 *
 * Pass `href` to render an `<a>` with the same variants. Defaults to
 * `type="button"` for button mode.
 */
export function Button(props: AsButton | AsLink) {
  const { variant = "blood", className = "", children } = props;
  const classes = [VARIANT_CLASSES[variant], className]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href != null) {
    const { variant: _v, className: _c, children: _ch, ...anchorProps } =
      props;
    return (
      <a {...anchorProps} className={classes}>
        {children}
      </a>
    );
  }

  const { variant: _v, className: _c, children: _ch, href: _h, ...btnProps } =
    props as AsButton;
  return (
    <button type="button" {...btnProps} className={classes}>
      {children}
    </button>
  );
}
