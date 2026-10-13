import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { SITE } from "./config/site";
import { isLocalDev, verifyAccess } from "./lib/access";
import { fail, isProductionHost } from "./lib/http";

const ADMIN = /^\/(admin|api\/admin)(\/|$)/;

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;

  // www → apex, before anything else.
  if (url.hostname === `www.${SITE.productionHost}`) {
    return Response.redirect(`${SITE.origin}${url.pathname}${url.search}`, 301);
  }

  const isAdmin = ADMIN.test(url.pathname);
  if (isAdmin) {
    if (isLocalDev(url)) {
      context.locals.adminEmail = "local-dev";
    } else {
      const result = await verifyAccess(context.request, {
        teamDomain: String(env.ACCESS_TEAM_DOMAIN ?? ""),
        aud: String(env.ACCESS_AUD ?? ""),
      });
      if (!result.ok) {
        console.warn(JSON.stringify({ msg: "admin-denied", reason: result.reason, path: url.pathname }));
        return url.pathname.startsWith("/api/")
          ? fail(403, "forbidden")
          : new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
      }
      context.locals.adminEmail = result.email;
    }
  }

  const response = await next();
  const h = response.headers;
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  // Astro sends its hashed CSP as a header on on-demand pages: extend it, never replace it.
  if (!url.pathname.startsWith("/media/")) {
    const csp = h.get("content-security-policy");
    h.set("content-security-policy", csp ? `${csp}; frame-ancestors 'none'` : "frame-ancestors 'none'");
  }
  if (isProductionHost(url)) h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  if (!isProductionHost(url) || isAdmin) h.set("x-robots-tag", "noindex, nofollow");
  if (isAdmin || url.pathname.startsWith("/api/")) h.set("cache-control", "private, no-store");
  return response;
});
