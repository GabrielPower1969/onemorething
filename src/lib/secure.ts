import { SITE } from "../config/site";

/**
 * The one place that decides security headers and canonical redirects for EVERY response —
 * pages, API, media and static files alike (src/worker.ts wraps the Astro handler with it).
 * Mirrors the posture of loyalasabook.com and flowgt.co.nz; docs/SECURITY.md maps each line.
 */

export const HSTS = "max-age=31536000; includeSubDomains; preload";

const isProdHost = (host: string) => host === SITE.productionHost || host === `www.${SITE.productionHost}`;

/** http → https and www → apex, in one 301. Localhost and other hosts are left alone. */
export function canonicalRedirect(url: URL): Response | null {
  if (!isProdHost(url.hostname)) return null;
  if (url.protocol === "https:" && url.hostname === SITE.productionHost) return null;
  return new Response(null, {
    status: 301,
    headers: { location: `${SITE.origin}${url.pathname}${url.search}`, "cache-control": "public, max-age=3600" },
  });
}

/** The security.txt alias required by older scanners (RFC 9116 §3: may redirect to the canonical file). */
export function securityTxtAlias(url: URL): Response | null {
  if (url.pathname !== "/security.txt") return null;
  return new Response(null, { status: 301, headers: { location: "/.well-known/security.txt" } });
}

const ADMIN = /^\/(admin|api\/admin)(\/|$)/;
const IMMUTABLE = /^\/(_astro|fonts)\//;

export function secure(request: Request, response: Response): Response {
  // 101 (WebSocket) responses can't be re-wrapped; this site has none, but stay safe.
  if (response.status === 101) return response;
  const url = new URL(request.url);
  const res = new Response(response.body, response);
  const h = res.headers;
  const isHtml = (h.get("content-type") ?? "").includes("text/html");
  const isAdmin = ADMIN.test(url.pathname);

  h.set("x-content-type-options", "nosniff");
  h.set("x-frame-options", "DENY");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  h.set("cross-origin-opener-policy", "same-origin");
  h.set("cross-origin-resource-policy", "same-origin");
  if (url.protocol === "https:" && isProdHost(url.hostname)) h.set("strict-transport-security", HSTS);
  else h.delete("strict-transport-security");

  // CSP: Astro sends a hashed policy for pages — extend it, never replace it. Everything that is not
  // a page (files, JSON, media) gets the tightest policy unless it set its own (e.g. /media sandbox).
  const csp = h.get("content-security-policy");
  if (isHtml && csp) {
    const extra = ["frame-ancestors 'none'", "upgrade-insecure-requests"].filter((d) => !csp.includes(d.split(" ")[0]));
    h.set("content-security-policy", [csp.replace(/;\s*$/, ""), ...extra].join("; "));
  } else if (!csp) {
    h.set("content-security-policy", isHtml ? "frame-ancestors 'none'; upgrade-insecure-requests" : "default-src 'none'; frame-ancestors 'none'");
  }

  if (!isProdHost(url.hostname) || isAdmin) h.set("x-robots-tag", "noindex, nofollow");

  // Caching. Admin/API never cached. Hashed build files and fonts are immutable. HTML always carries
  // no-transform so Cloudflare's edge never rewrites pages (e.g. auto-injecting its analytics beacon).
  if (isAdmin || url.pathname.startsWith("/api/")) {
    h.set("cache-control", "private, no-store, no-transform");
  } else if (IMMUTABLE.test(url.pathname) && res.ok) {
    h.set("cache-control", "public, max-age=31536000, immutable");
  } else if (isHtml) {
    const cc = h.get("cache-control");
    if (!cc) h.set("cache-control", "public, max-age=0, must-revalidate, no-transform");
    else if (!/no-transform/i.test(cc)) h.set("cache-control", `${cc}, no-transform`);
  }
  return res;
}
