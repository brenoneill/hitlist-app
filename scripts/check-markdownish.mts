// Runnable check for the Markdownish tokenizer — the one bit of parsing in the UI.
// Usage: npx tsx scripts/check-markdownish.mts
import assert from "node:assert/strict";
import {
  cleanPrBody,
  extractImages,
  stripImages,
  tokenize,
} from "../app/lib/markdownish";

// plain prose is one text token; empty input is no tokens
assert.deepEqual(tokenize("just words"), [{ kind: "text", text: "just words" }]);
assert.deepEqual(tokenize(""), []);

// an image, with the prose either side kept intact
assert.deepEqual(tokenize("see ![shot](https://x.dev/a.png) here"), [
  { kind: "text", text: "see " },
  { kind: "image", url: "https://x.dev/a.png", alt: "shot" },
  { kind: "text", text: " here" },
]);

// a link keeps its label; a bare url becomes its own label
assert.deepEqual(tokenize("[the PR](https://github.com/o/r/pull/1)"), [
  { kind: "link", url: "https://github.com/o/r/pull/1", text: "the PR" },
]);
assert.deepEqual(tokenize("https://cursor.com/agents/abc"), [
  { kind: "link", url: "https://cursor.com/agents/abc", text: "https://cursor.com/agents/abc" },
]);

// trailing sentence punctuation is prose, not url
assert.deepEqual(tokenize("open https://x.dev/a."), [
  { kind: "text", text: "open " },
  { kind: "link", url: "https://x.dev/a", text: "https://x.dev/a" },
  { kind: "text", text: "." },
]);

// adjacent artifacts, no text between them
assert.deepEqual(tokenize("![a](https://x.dev/1.png)![b](https://x.dev/2.png)"), [
  { kind: "image", url: "https://x.dev/1.png", alt: "a" },
  { kind: "image", url: "https://x.dev/2.png", alt: "b" },
]);

// an image is never mistaken for a link (the `!` must win)
assert.equal(tokenize("![](https://x.dev/a.png)")[0].kind, "image");

// trust boundary: non-http schemes and relative paths never become an href
assert.deepEqual(tokenize("[x](javascript:alert(1))"), [
  { kind: "text", text: "[x](javascript:alert(1))" },
]);
assert.deepEqual(tokenize("![x](/local/a.png)"), [
  { kind: "text", text: "![x](/local/a.png)" },
]);

// html <img> — the format the playbook actually tells agents to emit —
// in either attribute order, either quote style, extra attributes ignored
assert.deepEqual(tokenize('<img src="https://x.dev/a.png" alt="before">'), [
  { kind: "image", url: "https://x.dev/a.png", alt: "before" },
]);
assert.deepEqual(tokenize('<img alt="after" width="600" src="https://x.dev/b.png" />'), [
  { kind: "image", url: "https://x.dev/b.png", alt: "after" },
]);
assert.deepEqual(tokenize("<img src='https://x.dev/c.png'>"), [
  { kind: "image", url: "https://x.dev/c.png", alt: "" },
]);

// trust boundary holds for <img> too: unsafe/relative srcs stay inert text
assert.deepEqual(tokenize('<img src="javascript:alert(1)">'), [
  { kind: "text", text: '<img src="javascript:alert(1)">' },
]);
assert.deepEqual(tokenize('<img src="/opt/cursor/artifacts/x.png">'), [
  { kind: "text", text: '<img src="/opt/cursor/artifacts/x.png">' },
]);

// details/summary/br wrappers are stripped to newlines, content kept
assert.equal(
  tokenize("<details><summary>Shots</summary>hello<br/>world</details>")
    .map((t) => (t.kind === "text" ? t.text : ""))
    .join(""),
  "\n\nShots\nhello\nworld\n",
);

// extractImages: flattens texts, skips empties, dedupes by url
assert.deepEqual(
  extractImages(
    "![a](https://x.dev/a.png)",
    undefined,
    '<img src="https://x.dev/a.png" alt="dup"> <img src="https://x.dev/b.png">',
  ),
  [
    { url: "https://x.dev/a.png", alt: "a" },
    { url: "https://x.dev/b.png", alt: "" },
  ],
);

// Cursor footer badges ("Open in Web/Cursor") never enter the gallery
assert.deepEqual(
  extractImages(
    '<img alt="Open in Web" src="https://cursor.com/assets/images/open-in-web-dark.png"> ![real](https://cursor.com/artifacts/c/art-1)',
  ),
  [{ url: "https://cursor.com/artifacts/c/art-1", alt: "real" }],
);

// stripImages: images vanish along with the blank lines that framed them
assert.deepEqual(
  stripImages(tokenize('done.\n\n<img src="https://x.dev/a.png">\n\n![b](https://x.dev/b.png)')),
  [{ kind: "text", text: "done." }],
);
assert.deepEqual(
  stripImages(tokenize("![a](https://x.dev/a.png)\n\nsee [pr](https://g.h/1)")),
  [
    { kind: "text", text: "see " },
    { kind: "link", url: "https://g.h/1", text: "pr" },
  ],
);

// cleanPrBody: Cursor begin/end markers and appendix after END are dropped
assert.equal(
  cleanPrBody(
    "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->\n### TL;DR\nShip it.\n<!-- CURSOR_AGENT_PR_BODY_END -->\n" +
      '<div><a href="https://cursor.com/agents/bc-x"><img src="https://cursor.com/assets/images/open-in-web-dark.png"></a></div>',
  ),
  "### TL;DR\nShip it.",
);
assert.equal(
  cleanPrBody("preface\n<!-- CURSOR_AGENT_PR_BODY_END -->\n<footer junk>"),
  "preface",
);
assert.equal(
  cleanPrBody("<!-- CURSOR_AGENT_PR_BODY_BEGIN -->\nonly begin"),
  "only begin",
);
assert.equal(cleanPrBody("plain body <!-- note --> kept"), "plain body  kept");

console.log("markdownish: ok");
