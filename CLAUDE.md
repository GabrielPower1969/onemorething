# CLAUDE.md — map for agents and new contributors

Personal site for Gabriel Chen. Astro 7 on Cloudflare Workers, D1 + R2, Cloudflare Access for admin.
Full plan, decisions and review log: `docs/PLAN.md`. Update this file in the same commit as any
architecture change.

## Commands

| What | Command |
|---|---|
| Dev server (workerd, local D1/R2) | `npm run dev` → http://localhost:4321 |
| Local schema | `npm run db:migrate:local` |
| Local sample posts | `node scripts/seed-local.mjs` (localhost only) |
| All fast gates | `npm run check` (i18n-check → astro check → vitest) |
| E2E | `npm run e2e` (needs a running server; `BASE_URL=` to target the built preview) |
| Production build + local run | `npm run build && npx astro preview --port 4322` |
| Binding types after editing wrangler.jsonc | `npx wrangler types` |
| Review screenshots | `node scripts/shoot.mjs <baseUrl> <outDir> [paths…]` |

## Directory map

```
src/config/site.ts        every external URL, work entries, socials, feature flags
src/i18n/en.ts, zh.ts     every public string (zh typed as Messages: missing/extra key = TS error)
src/i18n/locales.ts       language codes (html/hreflang/og/rss/Intl), NZ time zone
src/i18n/alternates.ts    hreflang, canonical, language-toggle target — the only place that decides them
src/styles/tokens.css     design tokens (same names as the Figma variables)
src/views/*.astro         page bodies shared by EN and ZH routes
src/pages/**              thin route files; src/pages/zh/* also import styles/zh-fonts.css
src/lib/                  server logic: posts (D1), markdown (sanitizer), access (JWT), analytics, stats, media (R2)
src/scripts/              client JS: site.ts (public), typeon.ts, track.ts, admin.ts, head-inline.js
src/middleware.ts         admin lock, security headers, noindex off-production, www→apex
migrations/               D1 schema (additive within a release)
scripts/                  i18n-check, copy-fonts, seed-local, shoot, backup, provision, make-icons
tests/unit, tests/e2e     vitest / Playwright (+ axe, i18n leak crawl)
```

## Invariants (do not break)

1. **No hard-coded user-facing text** in components. Add keys to both locale files; `npm run i18n:check`.
2. **No personal data** on the site or in the repo: no phone, address, visa, family, school, church,
   private emails or private file paths. Contact is `gabriel@onemorething.today` only.
3. **Markdown is sanitized at save time and render time** (`src/lib/markdown.ts`); bump
   `SANITIZER_VERSION` when the allowlist changes. Never `set:html` anything else from the database.
4. **Admin fails closed.** `/admin*` and `/api/admin*` require a valid Access JWT
   (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`); only `astro dev` on localhost skips it. Keep these routes
   on-demand and in `assets.run_worker_first`.
5. **Home renders without D1.** Only the Writing block may disappear.
6. **Nothing from Google loads before a click**: YouTube posters are copied into R2; the player is
   youtube-nocookie.com after the visitor presses play.
7. **CSP stays strict**: no inline `style=""` attributes, no new inline scripts unless hashed in
   `astro.config.mjs` like `head-inline.js`. Middleware appends to Astro's CSP header, never replaces it.
8. **Analytics**: only allowlisted values reach D1 (`parseEvent`); the `events` table has no
   secondary indexes; salts are deleted after 48 h. Metric definitions: `docs/METRICS.md`.
9. **Migrations are additive** within a release (expand → contract across two releases).
10. Chinese copy: full-width punctuation, “” quotes, —— without spaces, no typed CJK–Latin spaces
    (except `meta.*`/`rss.*`, which are plain text).

## Verify a change

`npm run check`, then `npm run e2e` against dev, then against the built preview for anything touching
headers, CSP, middleware or scripts. Take screenshots with `scripts/shoot.mjs` for visual changes and
compare with the Figma frames.
