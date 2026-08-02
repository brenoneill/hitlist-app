// Runnable check for the Markdownish tokenizer — the one bit of parsing in the UI.
// Usage: npx tsx scripts/check-markdownish.mts
import assert from "node:assert/strict";
import { tokenize } from "../app/components/ui/Markdownish";

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

console.log("markdownish: ok");
