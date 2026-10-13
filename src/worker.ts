/**
 * Worker entry. Every request — pages, API, media and static files — passes through here
 * (`assets.run_worker_first: true`), so canonical redirects and security headers are applied
 * in exactly one place. The Astro handler serves static files itself when they match.
 */
import { handle } from "@astrojs/cloudflare/handler";
import { canonicalRedirect, secure, securityTxtAlias } from "./lib/secure";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const early = canonicalRedirect(url) ?? securityTxtAlias(url);
    if (early) return secure(request, early);
    const response = await handle(request, env, ctx);
    return secure(request, response);
  },
} satisfies ExportedHandler<Env>;
