import { describe, expect, it } from "vitest";
import { hreflangLinks, toggleHref, canonicalUrl } from "../../src/i18n/alternates";
import { localePath, splitLocale, rich, formatDate, useT } from "../../src/i18n";
import { validatePost, slugify } from "../../src/lib/posts";

describe("locale paths", () => {
  it("maps between locales", () => {
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("zh", "/")).toBe("/zh/");
    expect(localePath("zh", "/writing/x")).toBe("/zh/writing/x");
    expect(splitLocale("/zh/writing/x")).toEqual({ locale: "zh", path: "/writing/x" });
    expect(splitLocale("/zhou")).toEqual({ locale: "en", path: "/zhou" });
  });
});

describe("alternates", () => {
  it("emits reciprocal hreflang + x-default only when both exist", () => {
    const both = hreflangLinks({ locale: "zh", path: "/writing/a", available: ["en", "zh"] });
    expect(both.map((l) => l.hreflang)).toEqual(["en", "zh-Hans", "x-default"]);
    expect(both[2].href).toBe("https://onemorething.today/writing/a");
    expect(hreflangLinks({ locale: "en", path: "/writing/a", available: ["en"] })).toEqual([]);
  });
  it("toggles to the counterpart or the other Writing index", () => {
    expect(toggleHref({ locale: "en", path: "/writing/a", available: ["en", "zh"] })).toBe("/zh/writing/a");
    expect(toggleHref({ locale: "en", path: "/writing/a", available: ["en"] })).toBe("/zh/writing");
    expect(toggleHref({ locale: "zh", path: "/", available: ["en", "zh"] })).toBe("/");
  });
  it("builds canonicals from the configured origin", () => {
    expect(canonicalUrl({ locale: "zh", path: "/", available: ["en", "zh"] })).toBe("https://onemorething.today/zh/");
  });
});

describe("messages", () => {
  it("escapes before applying *emphasis*", () => {
    expect(rich("I’m *Gabriel <b>*")).toBe("I’m <em>Gabriel &lt;b&gt;</em>");
  });
  it("formats placeholders and NZ dates", () => {
    expect(useT("zh")("writing.minutes", { n: 3 })).toBe("3分钟");
    expect(formatDate("2026-10-12T21:00:00Z", "en")).toMatch(/13 Oct 2026/);
  });
});

describe("post validation", () => {
  const base = { slug: "a-post", kind: "text" as const, status: "published" as const, i18n: {} };
  it("needs one complete language to publish", () => {
    expect(validatePost(base).map((e) => e.code)).toContain("no-complete-language");
    expect(validatePost({ ...base, i18n: { en: { title: "T", summary: "S" } } })).toEqual([]);
  });
  it("flags a started-but-incomplete translation", () => {
    const errs = validatePost({ ...base, i18n: { en: { title: "T", summary: "S" }, zh: { title: "标题" } } });
    expect(errs).toContainEqual({ field: "i18n.zh", code: "incomplete" });
  });
  it("requires cover alt text when there is a cover", () => {
    expect(validatePost({ ...base, cover_key: "abc12345.jpg", i18n: { en: { title: "T", summary: "S" } } }).length).toBeGreaterThan(0);
  });
  it("lets drafts be incomplete but still checks the slug", () => {
    expect(validatePost({ ...base, status: "draft" })).toEqual([]);
    expect(validatePost({ ...base, status: "draft", slug: "Bad Slug" })[0].field).toBe("slug");
  });
  it("slugifies", () => {
    expect(slugify("Why this site is called one more thing!")).toBe("why-this-site-is-called-one-more-thing");
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
    expect(slugify("纯中文标题")).toBe("");
  });
});
