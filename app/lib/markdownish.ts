export type Token =
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; alt: string }
  | { kind: "link"; url: string; text: string };

// ![alt](url) | [text](url) | <img …> | bare url — in that order, so an image
// never matches as a link. Nothing else is markdown here.
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
const NOISE_TAGS = /<\/?(?:details|summary|p)[^>]*>|<br\s*\/?>/gi;

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

  const text = body.replace(NOISE_TAGS, "\n");
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
