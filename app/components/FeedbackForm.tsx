"use client";

import { type FormEvent, useState } from "react";
import { track } from "@vercel/analytics";
import { Button } from "@/app/components/Button";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { Textarea } from "@/app/components/ui/Textarea";
import { TextInput } from "@/app/components/ui/TextInput";

// Placeholder Formspree form id — swap when the real feedback form is created.
// Distinct from the UpdatesSignup id so inbox routing stays separate.
const FORMSPREE_ID = "xfeedback1";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Free-text feedback form that posts to Formspree. Optional email, required
 * message. Compact mode matches settings section spacing.
 *
 * @param compact - Settings-tab scale instead of landing marketing spacing.
 */
export function FeedbackForm({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Submits feedback to Formspree and updates local UI state.
   *
   * @param e - Form submit event (prevented from navigating away).
   */
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || status === "submitting") return;

    setStatus("submitting");
    setError(null);
    track("cta", { where: compact ? "feedback-settings" : "feedback-landing" });

    const payload: { message: string; email?: string } = {
      message: trimmedMessage,
    };
    const trimmedEmail = email.trim();
    if (trimmedEmail) payload.email = trimmedEmail;

    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Something went wrong — try again.");
      }

      setStatus("success");
      setMessage("");
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

  /**
   * Clears error state when the user edits a field after a failed submit.
   */
  function clearErrorOnEdit() {
    if (status === "error") {
      setStatus("idle");
      setError(null);
    }
  }

  return (
    <section
      className={
        compact
          ? "mb-6 border-t border-edge pt-4"
          : "border-t border-edge/80 pt-12 mt-16"
      }
    >
      <FieldLabel className={compact ? "mb-2" : "mb-2 mt-6 first:mt-0"}>
        Feedback
      </FieldLabel>
      {compact ? (
        <h3 className="text-sm font-semibold tracking-tight">
          Something to say?
        </h3>
      ) : (
        <h2 className="text-2xl font-bold tracking-tight">Send feedback</h2>
      )}
      <p
        className={`text-sm leading-relaxed text-muted ${compact ? "mt-1" : "mt-2 max-w-lg"}`}
      >
        Bugs, ideas, or whatever&apos;s on your mind — we read every note.
      </p>

      {status === "success" ? (
        <p
          aria-live="polite"
          className={`${compact ? "mt-3" : "mt-6"} font-mono text-[11px] uppercase tracking-widest text-ok`}
        >
          Thanks — we got your note
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className={`${compact ? "mt-3" : "mt-6"} flex flex-col gap-3`}
        >
          <div>
            <label htmlFor="feedback-message" className="sr-only">
              Feedback message
            </label>
            <Textarea
              id="feedback-message"
              name="message"
              required
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                clearErrorOnEdit();
              }}
              disabled={status === "submitting"}
              placeholder="What's on your mind?"
              rows={compact ? 3 : 4}
              tone="surface"
            />
          </div>
          <div>
            <label htmlFor="feedback-email" className="sr-only">
              Email address (optional)
            </label>
            <TextInput
              id="feedback-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErrorOnEdit();
              }}
              disabled={status === "submitting"}
              placeholder="Email (optional)"
              tone="surface"
            />
          </div>
          <Button
            type="submit"
            disabled={status === "submitting" || !message.trim()}
            className={compact ? "px-5" : "px-6 sm:self-start"}
          >
            {status === "submitting" ? "Sending…" : "Send feedback"}
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
