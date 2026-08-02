"use client";

import { useState } from "react";

export type Token =
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; alt: string }
  | { kind: "link"; url: string; text: string };

// ![alt](url) | [text](url) | bare url — in that order, so an image never
// matches as a link. Nothing else is markdown here.
const PATTERN =
  /!\[([^\]]*)\]\(([^\s)]+)\)|\[([^\]]*)\]\(([^\s)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g;

/** Only http(s) survives — a `[click](javascript:…)` body must not become an href. */
function safeUrl(url: string): string | undefined {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * Splits agent/PR prose into text, inline images and links. Cursor posts its
 * artifacts as markdown images in the PR body, so this is what makes screenshots
 * show up in the workspace instead of raw `![](…)`.
 */
export function tokenize(body: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  const push = (t: Token) => {
    if (t.kind === "text" && !t.text) return;
    out.push(t);
  };

  for (const m of body.matchAll(PATTERN)) {
    const [whole, imgAlt, imgUrl, linkText, linkUrl, bare] = m;
    // trailing sentence punctuation is prose, not part of a bare url
    const trimmed = bare?.replace(/[.,;:!?]+$/, "");
    const url = safeUrl(imgUrl ?? linkUrl ?? trimmed ?? "");
    if (!url) continue; // leave unsafe/relative markup in the surrounding text
    push({ kind: "text", text: body.slice(last, m.index) });
    if (imgUrl !== undefined) push({ kind: "image", url, alt: imgAlt });
    else push({ kind: "link", url, text: linkText || url });
    last = m.index + (trimmed ?? whole).length;
  }
  push({ kind: "text", text: body.slice(last) });
  return out;
}

const LINK_CLASS =
  "break-all text-info underline underline-offset-4 active:opacity-70";

/**
 * A GitHub artifact url resolves against the viewer's github.com session, and
 * `SameSite=Lax` cookies are not sent on a cross-site image load — so on a private
 * repo the image can fail. Fall back to a link rather than a broken-image icon.
 */
function InlineImage({ url, alt }: { url: string; alt: string }) {
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
        src={url}
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
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {tokenize(text).map((t, i) =>
        t.kind === "text" ? (
          <span key={i}>{t.text}</span>
        ) : t.kind === "image" ? (
          <InlineImage key={i} url={t.url} alt={t.alt} />
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
