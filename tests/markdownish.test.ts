import { describe, expect, it } from "vitest";
import {
  cleanPrBody,
  extractImages,
  parseBlocks,
  parseInline,
  stripImages,
  tokenize,
} from "@/app/lib/markdownish";

describe("tokenize", () => {
  it("keeps plain prose as one text token", () => {
    expect(tokenize("just words")).toEqual([{ kind: "text", text: "just words" }]);
    expect(tokenize("")).toEqual([]);
  });

  it("keeps prose around an image", () => {
    expect(tokenize("see ![shot](https://x.dev/a.png) here")).toEqual([
      { kind: "text", text: "see " },
      { kind: "image", url: "https://x.dev/a.png", alt: "shot" },
      { kind: "text", text: " here" },
    ]);
  });

  it("parses labeled and bare links", () => {
    expect(tokenize("[the PR](https://github.com/o/r/pull/1)")).toEqual([
      { kind: "link", url: "https://github.com/o/r/pull/1", text: "the PR" },
    ]);
    expect(tokenize("https://cursor.com/agents/abc")).toEqual([
      {
        kind: "link",
        url: "https://cursor.com/agents/abc",
        text: "https://cursor.com/agents/abc",
      },
    ]);
  });

  it("leaves trailing sentence punctuation as prose", () => {
    expect(tokenize("open https://x.dev/a.")).toEqual([
      { kind: "text", text: "open " },
      { kind: "link", url: "https://x.dev/a", text: "https://x.dev/a" },
      { kind: "text", text: "." },
    ]);
  });

  it("parses adjacent images with no text between them", () => {
    expect(tokenize("![a](https://x.dev/1.png)![b](https://x.dev/2.png)")).toEqual([
      { kind: "image", url: "https://x.dev/1.png", alt: "a" },
      { kind: "image", url: "https://x.dev/2.png", alt: "b" },
    ]);
  });

  it("prefers image over link when marked with !", () => {
    expect(tokenize("![](https://x.dev/a.png)")[0].kind).toBe("image");
  });

  it("never turns non-http schemes or relative paths into hrefs", () => {
    expect(tokenize("[x](javascript:alert(1))")).toEqual([
      { kind: "text", text: "[x](javascript:alert(1))" },
    ]);
    expect(tokenize("![x](/local/a.png)")).toEqual([
      { kind: "text", text: "![x](/local/a.png)" },
    ]);
  });

  it("parses html img in either attribute order and quote style", () => {
    expect(tokenize('<img src="https://x.dev/a.png" alt="before">')).toEqual([
      { kind: "image", url: "https://x.dev/a.png", alt: "before" },
    ]);
    expect(
      tokenize('<img alt="after" width="600" src="https://x.dev/b.png" />'),
    ).toEqual([{ kind: "image", url: "https://x.dev/b.png", alt: "after" }]);
    expect(tokenize("<img src='https://x.dev/c.png'>")).toEqual([
      { kind: "image", url: "https://x.dev/c.png", alt: "" },
    ]);
  });

  it("keeps unsafe or relative img src as inert text", () => {
    expect(tokenize('<img src="javascript:alert(1)">')).toEqual([
      { kind: "text", text: '<img src="javascript:alert(1)">' },
    ]);
    expect(tokenize('<img src="/opt/cursor/artifacts/x.png">')).toEqual([
      { kind: "text", text: '<img src="/opt/cursor/artifacts/x.png">' },
    ]);
  });

  it("strips details/summary/br wrappers to newlines", () => {
    expect(
      tokenize("<details><summary>Shots</summary>hello<br/>world</details>")
        .map((t) => (t.kind === "text" ? t.text : ""))
        .join(""),
    ).toBe("\n\nShots\nhello\nworld\n");
  });
});

describe("extractImages / stripImages / cleanPrBody", () => {
  it("flattens texts, skips empties, and dedupes by url", () => {
    expect(
      extractImages(
        "![a](https://x.dev/a.png)",
        undefined,
        '<img src="https://x.dev/a.png" alt="dup"> <img src="https://x.dev/b.png">',
      ),
    ).toEqual([
      { url: "https://x.dev/a.png", alt: "a" },
      { url: "https://x.dev/b.png", alt: "" },
    ]);
  });

  it("drops Cursor footer badges from the gallery", () => {
    expect(
      extractImages(
        '<img alt="Open in Web" src="https://cursor.com/assets/images/open-in-web-dark.png"> ![real](https://cursor.com/artifacts/c/art-1)',
      ),
    ).toEqual([{ url: "https://cursor.com/artifacts/c/art-1", alt: "real" }]);
  });

  it("strips images and the blank lines that framed them", () => {
    expect(
      stripImages(
        tokenize('done.\n\n<img src="https://x.dev/a.png">\n\n![b](https://x.dev/b.png)'),
      ),
    ).toEqual([{ kind: "text", text: "done." }]);
    expect(
      stripImages(tokenize("![a](https://x.dev/a.png)\n\nsee [pr](https://g.h/1)")),
    ).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", url: "https://g.h/1", text: "pr" },
    ]);
  });

  it("drops Cursor begin/end markers and appendix after END", () => {
    expect(
      cleanPrBody(
        "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->\n### TL;DR\nShip it.\n<!-- CURSOR_AGENT_PR_BODY_END -->\n" +
          '<div><a href="https://cursor.com/agents/bc-x"><img src="https://cursor.com/assets/images/open-in-web-dark.png"></a></div>',
      ),
    ).toBe("### TL;DR\nShip it.");
    expect(cleanPrBody("preface\n<!-- CURSOR_AGENT_PR_BODY_END -->\n<footer junk>")).toBe(
      "preface",
    );
    expect(cleanPrBody("<!-- CURSOR_AGENT_PR_BODY_BEGIN -->\nonly begin")).toBe(
      "only begin",
    );
    expect(cleanPrBody("plain body <!-- note --> kept")).toBe("plain body  kept");
  });
});

describe("parseInline / parseBlocks", () => {
  it("parses bold, code, and links", () => {
    expect(parseInline("use `Sheet` and **review** it")).toEqual([
      { kind: "text", text: "use " },
      { kind: "code", text: "Sheet" },
      { kind: "text", text: " and " },
      { kind: "strong", children: [{ kind: "text", text: "review" }] },
      { kind: "text", text: " it" },
    ]);
    expect(parseInline("see [pr](https://g.h/1).")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", url: "https://g.h/1", text: "pr" },
      { kind: "text", text: "." },
    ]);
    expect(parseInline("snap_mandatory ok")).toEqual([
      { kind: "text", text: "snap_mandatory ok" },
    ]);
  });

  it("parses headings, lists, fenced code, and paragraphs", () => {
    expect(
      parseBlocks("### TL;DR\n\nShip **it**.\n\n- one `a`\n- two\n\n1. first\n2. second"),
    ).toEqual([
      {
        kind: "heading",
        level: 3,
        children: [{ kind: "text", text: "TL;DR" }],
      },
      {
        kind: "paragraph",
        children: [
          { kind: "text", text: "Ship " },
          { kind: "strong", children: [{ kind: "text", text: "it" }] },
          { kind: "text", text: "." },
        ],
      },
      {
        kind: "list",
        ordered: false,
        items: [
          [
            { kind: "text", text: "one " },
            { kind: "code", text: "a" },
          ],
          [{ kind: "text", text: "two" }],
        ],
      },
      {
        kind: "list",
        ordered: true,
        items: [
          [{ kind: "text", text: "first" }],
          [{ kind: "text", text: "second" }],
        ],
      },
    ]);
    expect(parseBlocks("```ts\nconst x = 1;\n```")).toEqual([
      { kind: "code", lang: "ts", text: "const x = 1;" },
    ]);
  });

  it("hides gallery images from description prose when asked", () => {
    expect(
      parseBlocks("### Shots\n\n![a](https://x.dev/a.png)\n\nDone.", {
        hideImages: true,
      }),
    ).toEqual([
      {
        kind: "heading",
        level: 3,
        children: [{ kind: "text", text: "Shots" }],
      },
      {
        kind: "paragraph",
        children: [{ kind: "text", text: "Done." }],
      },
    ]);
  });

  it("strips recording_ref chrome and keeps the inner label", () => {
    expect(
      parseBlocks(
        '<recording_ref src="/opt/cursor/artifacts/x.mp4">Swipe left</recording_ref>',
      ),
    ).toEqual([
      {
        kind: "paragraph",
        children: [{ kind: "text", text: "Swipe left" }],
      },
    ]);
  });
});
