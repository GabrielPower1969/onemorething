import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { isLocalDev, verifyAccess } from "./lib/access";
import { fail } from "./lib/http";

/**
 * Admin lock only. Redirects and security headers for every response live in src/lib/secure.ts
 * (applied by src/worker.ts), so a new route can never miss a header.
 */
const ADMIN = /^\/(admin|api\/admin)(\/|$)/;

const forbidden = (isApi: boolean) =>
  isApi ? fail(403, "forbidden") : new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } });

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  if (!ADMIN.test(url.pathname)) return next();
  const isApi = url.pathname.startsWith("/api/");

  if (isLocalDev(url)) {
    context.locals.adminEmail = "local-dev";
    return next();
  }

  // Rate limit before any crypto work (defence in depth behind Cloudflare Access).
  if (isApi) {
    try {
      const { success } = await env.ADMIN_RL.limit({ key: context.clientAddress || "unknown" });
      if (!success) return fail(429, "rate-limited");
    } catch {
      // Limiter unavailable: Access + JWT still guard the route.
    }
  }

  const result = await verifyAccess(context.request, {
    teamDomain: String(env.ACCESS_TEAM_DOMAIN ?? ""),
    aud: String(env.ACCESS_AUD ?? ""),
  });
  if (!result.ok) {
    console.warn(JSON.stringify({ msg: "admin-denied", reason: result.reason, path: url.pathname }));
    return forbidden(isApi);
  }
  context.locals.adminEmail = result.email;
  return next();
});
