"use client";

import { useState, type ReactNode } from "react";
import {
  parseBlocks,
  type Block,
  type Inline,
} from "../../lib/markdownish";

const LINK_CLASS =
  "break-all text-info underline underline-offset-4 active:opacity-70";

const CODE_CLASS =
  "rounded-md border border-edge bg-background px-1 py-0.5 font-mono text-[0.9em] text-foreground";

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

function renderInline(
  nodes: Inline[],
  resolveImageUrl?: (url: string) => string,
): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.kind === "text") return <span key={i}>{n.text}</span>;
    if (n.kind === "code")
      return (
        <code key={i} className={CODE_CLASS}>
          {n.text}
        </code>
      );
    if (n.kind === "strong")
      return (
        <strong key={i} className="font-semibold text-foreground">
          {renderInline(n.children, resolveImageUrl)}
        </strong>
      );
    if (n.kind === "em")
      return <em key={i}>{renderInline(n.children, resolveImageUrl)}</em>;
    if (n.kind === "link")
      return (
        <a
          key={i}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {n.text}
        </a>
      );
    return (
      <InlineImage
        key={i}
        url={n.url}
        src={resolveImageUrl ? resolveImageUrl(n.url) : n.url}
        alt={n.alt}
      />
    );
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-base font-semibold text-foreground",
  2: "text-sm font-semibold text-foreground",
  3: "text-sm font-semibold text-foreground",
  4: "text-xs font-semibold text-foreground",
  5: "text-xs font-semibold text-foreground",
  6: "text-xs font-semibold text-foreground",
};

function BlockView({
  block,
  resolveImageUrl,
}: {
  block: Block;
  resolveImageUrl?: (url: string) => string;
}) {
  if (block.kind === "heading") {
    const className = HEADING_CLASS[block.level] ?? HEADING_CLASS[3];
    const children = renderInline(block.children, resolveImageUrl);
    switch (block.level) {
      case 1:
        return <h1 className={className}>{children}</h1>;
      case 2:
        return <h2 className={className}>{children}</h2>;
      case 3:
        return <h3 className={className}>{children}</h3>;
      case 4:
        return <h4 className={className}>{children}</h4>;
      case 5:
        return <h5 className={className}>{children}</h5>;
      default:
        return <h6 className={className}>{children}</h6>;
    }
  }

  if (block.kind === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag
        className={
          block.ordered
            ? "list-decimal space-y-1 pl-5"
            : "list-disc space-y-1 pl-5"
        }
      >
        {block.items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item, resolveImageUrl)}
          </li>
        ))}
      </Tag>
    );
  }

  if (block.kind === "code") {
    return (
      <pre className="overflow-x-auto rounded-lg border border-edge bg-background p-3 font-mono text-[0.85em] leading-relaxed text-foreground">
        <code>{block.text}</code>
      </pre>
    );
  }

  return (
    <p className="leading-relaxed">{renderInline(block.children, resolveImageUrl)}</p>
  );
}

/** Renders GitHub/Cursor-style markdown: headings, lists, code, bold, links, images. */
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
  const blocks = parseBlocks(text, { hideImages });
  return (
    <div className={`space-y-3 break-words ${className}`}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} resolveImageUrl={resolveImageUrl} />
      ))}
    </div>
  );
}
