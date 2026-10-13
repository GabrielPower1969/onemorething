import { describe, expect, it } from "vitest";
import { renderMarkdown, readingMinutes } from "../../src/lib/markdown";

describe("renderMarkdown sanitizer", () => {
  const payloads = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "[click](javascript:alert(1))",
    "[click](JaVaScRiPt:alert(1))",
    "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
    "![x](javascript:alert(1))",
    '<a href="https://ok.example" onclick="alert(1)">x</a>',
    "<iframe src=https://evil.example></iframe>",
    "<svg><script>alert(1)</script></svg>",
    '<div style="background:url(javascript:alert(1))">x</div>',
    "[x](//evil.example/path)",
  ];
  it.each(payloads)("neutralises %s", (md) => {
    const html = renderMarkdown(md);
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:|data:text|<iframe|<svg|style=/i);
    expect(html).not.toMatch(/href="\/\/evil/);
  });

  it("keeps ordinary formatting", () => {
    const html = renderMarkdown("## Title\n\n**bold** and *it* with [a link](https://example.com)\n\n> quote");
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>it</em>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain('rel="noopener nofollow"');
  });

  it("allows mailto and relative links", () => {
    expect(renderMarkdown("[m](mailto:gabriel@onemorething.today)")).toContain('href="mailto:gabriel@onemorething.today"');
    expect(renderMarkdown("[w](/writing)")).toContain('href="/writing"');
  });

  it("only allows https or same-site images", () => {
    expect(renderMarkdown("![a](http://insecure.example/a.png)")).not.toContain("http://insecure");
    expect(renderMarkdown("![a](https://ok.example/a.png)")).toContain('src="https://ok.example/a.png"');
  });

  it("estimates reading time for both scripts", () => {
    expect(readingMinutes("word ".repeat(460))).toBe(2);
    expect(readingMinutes("字".repeat(800))).toBe(2);
  });
});
