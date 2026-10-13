// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The one is:inline script (src/layouts/Base.astro) must be allowed by hash; Astro only hashes
// scripts it bundles itself.
const headInline = readFileSync(new URL("./src/scripts/head-inline.js", import.meta.url), "utf8");
const headInlineHash = /** @type {`sha256-${string}`} */ (`sha256-${createHash("sha256").update(headInline).digest("base64")}`);

export default defineConfig({
  site: "https://onemorething.today",
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  session: false,
  trailingSlash: "ignore",
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh"],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  security: {
    checkOrigin: true,
    csp: {
      scriptDirective: { hashes: [headInlineHash] },
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "media-src 'self' https:",
        "frame-src https://www.youtube-nocookie.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
