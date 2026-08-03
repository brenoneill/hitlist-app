export type Token =
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; alt: string }
  | { kind: "link"; url: string; text: string };

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; url: string; text: string }
  | { kind: "image"; url: string; alt: string };

export type Block =
  | { kind: "heading"; level: number; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; lang: string; text: string };

// ![alt](url) | [text](url) | <img …> | bare url — in that order, so an image
// never matches as a link. Used by extractImages / legacy tokenize.
const PATTERN =
  /!\[([^\]]*)\]\(([^\s)]+)\)|\[([^\]]*)\]\(([^\s)]+)\)|(<img\b[^>]*>)|(https?:\/\/[^\s<>()[\]]+)/g;

/** Only http(s) survives — a `[click](javascript:…)` body must not become an href. */
export function safeUrl(url: string): string | undefined {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function imgAttr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m?.[2] ?? m?.[3] ?? "";
}

// ponytail: tag-stripping only, real HTML rendering never
const NOISE_TAGS =
  /<\/?(?:details|summary|p|div|span)[^>]*>|<br\s*\/?>|<\/?recording_ref\b[^>]*>/gi;

const PR_BODY_BEGIN = /<!--\s*CURSOR_AGENT_PR_BODY_BEGIN\s*-->/i;
const PR_BODY_END = /<!--\s*CURSOR_AGENT_PR_BODY_END\s*-->/i;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Keeps the agent-written PR write-up and drops Cursor wrapper tags plus
 * anything after the body end marker (footer badges / appendix HTML).
 *
 * @param body - Raw GitHub PR body, possibly wrapped in Cursor markers.
 * @returns Trimmed prose between the markers (or the body with comments stripped).
 */
export function cleanPrBody(body: string): string {
  let text = body;
  const beginAt = text.search(PR_BODY_BEGIN);
  const endAt = text.search(PR_BODY_END);

  if (beginAt !== -1 && endAt !== -1 && endAt > beginAt) {
    const afterBegin = text.slice(beginAt).replace(PR_BODY_BEGIN, "");
    const endInSlice = afterBegin.search(PR_BODY_END);
    text = endInSlice === -1 ? afterBegin : afterBegin.slice(0, endInSlice);
  } else if (endAt !== -1) {
    text = text.slice(0, endAt);
  } else if (beginAt !== -1) {
    text = text.replace(PR_BODY_BEGIN, "");
  }

  return text.replace(HTML_COMMENT, "").trim();
}

function preprocess(body: string): string {
  return body
    .replace(NOISE_TAGS, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Splits agent/PR prose into text, inline images and links. Cursor posts its
 * artifacts as markdown images or HTML <img> tags in the PR body, so this is
 * what makes screenshots show up in the workspace instead of raw markup.
 */
export function tokenize(body: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  const push = (t: Token) => {
    if (t.kind === "text" && !t.text) return;
    out.push(t);
  };

  const text = preprocess(body);
  for (const m of text.matchAll(PATTERN)) {
    const [whole, imgAlt, imgUrl, linkText, linkUrl, imgTag, bare] = m;
    // trailing sentence punctuation is prose, not part of a bare url
    const trimmed = bare?.replace(/[.,;:!?]+$/, "");
    const src = imgTag !== undefined ? imgAttr(imgTag, "src") : undefined;
    const url = safeUrl(imgUrl ?? linkUrl ?? src ?? trimmed ?? "");
    if (!url) continue; // leave unsafe/relative markup in the surrounding text
    push({ kind: "text", text: text.slice(last, m.index) });
    if (imgUrl !== undefined) push({ kind: "image", url, alt: imgAlt });
    else if (imgTag !== undefined)
      push({ kind: "image", url, alt: imgAttr(imgTag, "alt") });
    else push({ kind: "link", url, text: linkText || url });
    last = m.index + (trimmed ?? whole).length;
  }
  push({ kind: "text", text: text.slice(last) });
  return out;
}

/**
 * Drops image tokens along with the blank lines that framed them, so prose
 * rendered next to a gallery doesn't keep empty gaps where images used to be.
 */
export function stripImages(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const t of tokens) {
    if (t.kind === "image") continue;
    const prev = out[out.length - 1];
    if (t.kind === "text" && prev?.kind === "text") prev.text += t.text;
    else out.push({ ...t });
  }
  for (const t of out) {
    if (t.kind === "text") t.text = t.text.replace(/\n{3,}/g, "\n\n");
  }
  const first = out[0];
  if (first?.kind === "text") first.text = first.text.replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last?.kind === "text") last.text = last.text.replace(/\s+$/, "");
  return out.filter((t) => t.kind !== "text" || t.text);
}

// Cursor's "Open in Web/Cursor" footer badges are images too — never proof.
const BADGE_URL = /^https:\/\/cursor\.com\/assets\//;

/** Every inline image across the given texts, deduped by url — feeds the gallery. */
export function extractImages(
  ...texts: (string | null | undefined)[]
): { url: string; alt: string }[] {
  const seen = new Set<string>();
  const out: { url: string; alt: string }[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const t of tokenize(text)) {
      if (t.kind !== "image" || BADGE_URL.test(t.url) || seen.has(t.url))
        continue;
      seen.add(t.url);
      out.push({ url: t.url, alt: t.alt });
    }
  }
  return out;
}

// Asterisks only for emphasis — underscores collide with snake_case paths.
const INLINE_PATTERN =
  /(!\[([^\]]*)\]\(([^\s)]+)\))|(\[([^\]]*)\]\(([^\s)]+)\))|(<img\b[^>]*>)|(`+)([^`]+)\8|(\*\*)(.+?)\10|(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)|(https?:\/\/[^\s<>()[\]]+)/g;

/**
 * Parses inline markdown: images, links, code, bold, italic, bare urls.
 *
 * @param text - A single block's inline source (no block structure).
 * @returns Inline nodes safe to render (non-http urls stay as text).
 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const pushText = (value: string) => {
    if (!value) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text") prev.text += value;
    else out.push({ kind: "text", text: value });
  };

  for (const m of text.matchAll(INLINE_PATTERN)) {
    const index = m.index ?? 0;
    pushText(text.slice(last, index));
    const [
      whole,
      ,
      imgAlt,
      imgUrl,
      ,
      linkText,
      linkUrl,
      imgTag,
      ,
      codeBody,
      ,
      strongBody,
      emBody,
      bare,
    ] = m;

    if (imgUrl !== undefined) {
      const url = safeUrl(imgUrl);
      if (url) out.push({ kind: "image", url, alt: imgAlt ?? "" });
      else pushText(whole);
    } else if (imgTag !== undefined) {
      const url = safeUrl(imgAttr(imgTag, "src"));
      if (url) out.push({ kind: "image", url, alt: imgAttr(imgTag, "alt") });
      else pushText(whole);
    } else if (linkUrl !== undefined) {
      const url = safeUrl(linkUrl);
      if (url) out.push({ kind: "link", url, text: linkText || url });
      else pushText(whole);
    } else if (codeBody !== undefined) {
      out.push({ kind: "code", text: codeBody });
    } else if (strongBody !== undefined) {
      out.push({ kind: "strong", children: parseInline(strongBody) });
    } else if (emBody !== undefined) {
      out.push({ kind: "em", children: parseInline(emBody) });
    } else if (bare !== undefined) {
      const trimmed = bare.replace(/[.,;:!?]+$/, "");
      const url = safeUrl(trimmed);
      if (url) {
        out.push({ kind: "link", url, text: url });
        pushText(bare.slice(trimmed.length));
      } else pushText(whole);
    }
    last = index + whole.length;
  }
  pushText(text.slice(last));
  return out;
}

function isImageOnly(children: Inline[]): children is [Extract<Inline, { kind: "image" }>] {
  return children.length === 1 && children[0]?.kind === "image";
}

/**
 * Parses GitHub/Cursor-style markdown into blocks (headings, lists, code, paragraphs).
 *
 * @param body - Cleaned PR / agent prose.
 * @param opts.hideImages - Drop image-only lines (gallery already shows them).
 * @returns Block tree for Markdownish.
 */
export function parseBlocks(
  body: string,
  opts: { hideImages?: boolean } = {},
): Block[] {
  const text = preprocess(body);
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const joined = buf.join("\n").trim();
    if (!joined) return;
    const children = parseInline(joined);
    if (opts.hideImages && isImageOnly(children)) return;
    if (opts.hideImages) {
      const filtered = children.filter((c) => c.kind !== "image");
      if (filtered.length === 0) return;
      blocks.push({ kind: "paragraph", children: filtered });
      return;
    }
    blocks.push({ kind: "paragraph", children });
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^```([\w-.]*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const chunk: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        chunk.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1; // closing fence
      blocks.push({ kind: "code", lang, text: chunk.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        children: parseInline(heading[2]),
      });
      i += 1;
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.+)$/);
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ul || ol) {
      const ordered = !!ol;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const item = ordered
          ? cur.match(/^\d+\.\s+(.+)$/)
          : cur.match(/^[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(parseInline(item[1]));
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (!cur.trim()) break;
      if (/^```/.test(cur)) break;
      if (/^#{1,6}\s+/.test(cur)) break;
      if (/^[-*+]\s+/.test(cur)) break;
      if (/^\d+\.\s+/.test(cur)) break;
      buf.push(cur);
      i += 1;
    }
    flushParagraph(buf);
  }

  return blocks;
}
