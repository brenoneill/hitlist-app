"use client";

import { type ButtonHTMLAttributes } from "react";
import { BLOOD_BUTTON } from "@/app/components/Icons";

export type ButtonVariant = "blood" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  blood: BLOOD_BUTTON,
  ghost: "text-muted underline underline-offset-4",
};

/**
 * Reusable button component.
 *
 * - `blood` — the signature glowing red action button; append layout classes
 *   (e.g. `px-6`, `w-full`, `inline-flex items-center gap-2`) via `className`.
 * - `ghost` — a text-link–style button; append size / font classes via
 *   `className` (e.g. `font-mono text-xs` or `text-sm`).
 *
 * Defaults to `type="button"` to prevent accidental form submission.
 * Pass `type="submit"` explicitly when the button lives inside a `<form>`.
 */
export function Button({
  variant = "blood",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={[VARIANT_CLASSES[variant], className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
