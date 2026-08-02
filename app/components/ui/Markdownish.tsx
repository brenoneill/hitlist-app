"use client";

import { useState } from "react";
import { stripImages, tokenize } from "../../lib/markdownish";

const LINK_CLASS =
  "break-all text-info underline underline-offset-4 active:opacity-70";

/**
 * A GitHub artifact url resolves against the viewer's github.com session, and
 * `SameSite=Lax` cookies are not sent on a cross-site image load — so on a private
 * repo the image can fail. Fall back to a link rather than a broken-image icon.
 */
function InlineImage({ url, src, alt }: { url: string; src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {alt || "View artifact"} ↗
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="my-2 block">
      {/* eslint-disable-next-line @next/next/no-img-element -- artifact hosts are arbitrary and unknown ahead of time */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-w-full rounded-lg border border-edge"
      />
    </a>
  );
}

/** Renders `text` with inline images and tappable links; everything else stays prose. */
export function Markdownish({
  text,
  className = "",
  hideImages = false,
  resolveImageUrl,
}: {
  text: string;
  className?: string;
  /** Skip image tokens — used where a gallery already shows them. */
  hideImages?: boolean;
  /** Rewrites image srcs (e.g. through the auth proxy); links keep the original url. */
  resolveImageUrl?: (url: string) => string;
}) {
  const tokens = hideImages ? stripImages(tokenize(text)) : tokenize(text);
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {tokens.map((t, i) =>
        t.kind === "text" ? (
          <span key={i}>{t.text}</span>
        ) : t.kind === "image" ? (
          <InlineImage
            key={i}
            url={t.url}
            src={resolveImageUrl ? resolveImageUrl(t.url) : t.url}
            alt={t.alt}
          />
        ) : (
          <a
            key={i}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {t.text}
          </a>
        ),
      )}
    </div>
  );
}
