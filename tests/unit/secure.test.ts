import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalRedirect, secure, securityTxtAlias, HSTS } from "../../src/lib/secure";

const req = (u: string) => new Request(u);
const html = (csp?: string) =>
  new Response("<!doctype html>", { headers: { "content-type": "text/html", ...(csp ? { "content-security-policy": csp } : {}) } });

describe("canonical redirects", () => {
  it.each([
    ["http://onemorething.today/zh/?a=1", "https://onemorething.today/zh/?a=1"],
    ["https://www.onemorething.today/writing", "https://onemorething.today/writing"],
    ["http://www.onemorething.today/", "https://onemorething.today/"],
  ])("%s → %s", (from, to) => {
    const r = canonicalRedirect(new URL(from));
    expect(r?.status).toBe(301);
    expect(r?.headers.get("location")).toBe(to);
  });
  it("leaves the canonical origin and localhost alone", () => {
    expect(canonicalRedirect(new URL("https://onemorething.today/"))).toBeNull();
    expect(canonicalRedirect(new URL("http://localhost:4321/"))).toBeNull();
  });
  it("aliases /security.txt to the well-known path", () => {
    expect(securityTxtAlias(new URL("https://onemorething.today/security.txt"))?.headers.get("location")).toBe("/.well-known/security.txt");
  });
});

describe("secure()", () => {
  it("applies the full header set to pages and extends Astro's CSP", () => {
    const r = secure(req("https://onemorething.today/"), html("default-src 'self'; script-src 'self' 'sha256-x'"));
    const h = r.headers;
    expect(h.get("strict-transport-security")).toBe(HSTS);
    expect(h.get("x-frame-options")).toBe("DENY");
    expect(h.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(h.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(h.get("x-content-type-options")).toBe("nosniff");
    expect(h.get("content-security-policy")).toBe(
      "default-src 'self'; script-src 'self' 'sha256-x'; frame-ancestors 'none'; upgrade-insecure-requests",
    );
    expect(h.get("cache-control")).toContain("no-transform");
    expect(h.get("x-robots-tag")).toBeNull();
  });
  it("locks down static files and keeps a route's own CSP", () => {
    const css = secure(req("https://onemorething.today/_astro/a.css"), new Response("x", { headers: { "content-type": "text/css" } }));
    expect(css.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(css.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    const media = secure(
      req("https://onemorething.today/media/x.jpg"),
      new Response("x", { headers: { "content-type": "image/jpeg", "content-security-policy": "default-src 'none'; sandbox" } }),
    );
    expect(media.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
  });
  it("never caches admin/API and keeps them out of search", () => {
    const r = secure(req("https://onemorething.today/api/admin/posts"), new Response("{}", { headers: { "content-type": "application/json" } }));
    expect(r.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("sends no HSTS off the production https origin, and noindexes other hosts", () => {
    const r = secure(req("http://localhost:4321/"), html());
    expect(r.headers.get("strict-transport-security")).toBeNull();
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("security.txt", () => {
  const txt = readFileSync("public/.well-known/security.txt", "utf8");
  it("has the required fields", () => {
    expect(txt).toMatch(/^Contact: mailto:gabriel@onemorething\.today$/m);
    expect(txt).toMatch(/^Canonical: https:\/\/onemorething\.today\/\.well-known\/security\.txt$/m);
  });
  it("does not expire within the next 30 days (RFC 9116 §2.5.5)", () => {
    const expires = Date.parse(txt.match(/^Expires: (.+)$/m)![1]);
    expect(expires - Date.now()).toBeGreaterThan(30 * 86_400_000);
  });
});
