"use client";

import { type FormEvent, useState } from "react";
import { track } from "@vercel/analytics";
import { Button } from "@/app/components/Button";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { TextInput } from "@/app/components/ui/TextInput";

const FORMSPREE_ID = "xrpzyryo";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Landing-page email capture that posts to Formspree. Shows a thank-you
 * state on success and an inline error if the request fails.
 */
export function UpdatesSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Submits the email to Formspree and updates local UI state.
   *
   * @param e - Form submit event (prevented from navigating away).
   */
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || status === "submitting") return;

    setStatus("submitting");
    setError(null);
    track("cta", { where: "updates-signup" });

    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Something went wrong — try again.");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong — try again.",
      );
    }
  }

  return (
    <section className="border-t border-edge/80 pt-12 mt-16">
      <FieldLabel className="mb-2 mt-6 first:mt-0">Updates</FieldLabel>
      <h2 className="text-2xl font-bold tracking-tight">
        Sign up for updates
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        Occasional notes on new providers, phone-review features, and what
        we&apos;re shipping next. No spam.
      </p>

      {status === "success" ? (
        <p
          aria-live="polite"
          className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ok"
        >
          You&apos;re on the list — thank you
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="updates-email" className="sr-only">
              Email address
            </label>
            <TextInput
              id="updates-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setError(null);
                }
              }}
              disabled={status === "submitting"}
              placeholder="you@example.com"
              tone="surface"
            />
          </div>
          <Button
            type="submit"
            disabled={status === "submitting" || !email.trim()}
            className="px-6 sm:shrink-0"
          >
            {status === "submitting" ? "Signing up…" : "Sign up"}
          </Button>
        </form>
      )}

      {error && (
        <ErrorText role="alert" className="mt-3">
          {error}
        </ErrorText>
      )}
    </section>
  );
}
