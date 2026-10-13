# onemorething.today — v1 Plan

Status: **r3** · 2026-10-13 · owner: Gabriel Chen · author: Claude
r1 was reviewed by four independent reviewers (design/UX, architecture/security,
i18n/SEO/analytics, release/QA). Their findings are folded in below; the review log is §14.

---

## 0. What we are building

A personal homepage, portfolio and blog for Gabriel Chen at **https://onemorething.today**.

- **Tone:** LoveFrom-like. Black on off-white, one serif, lots of air, centred statements,
  one quiet continuous animation, text that types itself in.
- **Audience:** friends, curious people, collaborators, investors, followers. In under 20 seconds
  they should know who Gabriel is, what he has made, and how to reach him.
- **Languages:** English first at `/`, Chinese at `/zh/`, toggle top right. Every public string
  lives in `src/i18n/{en,zh}.ts`; build gates fail on any missing key or hard-coded string.
- **Owner tools:** private `/admin` to write posts, publish video/audio posts by link with a cover,
  and read traffic.
- **Gates:** Figma design → local preview + screenshots → **Gabriel approves** → staged launch.

Non-goals for v1: comments, newsletter, search, multi-author, self-hosted media files, Bilibili
embeds (v1.1), per-post OG image generation (v1.1), percentage canaries (no traffic yet).

---

## 1. Facts this plan depends on

| # | Fact | Source · level · checked |
|---|---|---|
| F1 | Domain is on Cloudflare DNS | `dig NS` → `*.ns.cloudflare.com` · A · 2026-10-13 |
| F2 | `gabriel@onemorething.today` already forwards to Gabriel's inbox via Email Routing | release reviewer, `wrangler` read-only · A · 2026-10-13 — **r1 said "unknown"; overturned by A-level evidence** |
| F3 | Current wrangler OAuth login can create D1/R2 and read zones/email routing; it cannot configure Cloudflare Access | `wrangler whoami` scope list · A · 2026-10-13 — **r1 said "workers write only"; that was a truncated read of the scope list** |
| F4 | Repo `GabrielPower1969/onemorething` is public and empty; SSH push works | `gh repo view`, `ssh -T` · A · 2026-10-13 |
| F5 | astro 7.3.8, @astrojs/cloudflare 14.3.4, wrangler 4.149.0 (pinned as devDependency) | `npm view`, installed · A · 2026-10-13 |
| F6 | Astro 7: bindings via `import { env } from "cloudflare:workers"`; `Astro.locals.runtime` removed; `session: false` and `security.csp` exist | adapter + astro type definitions in `node_modules` · A · 2026-10-13 |
| F7 | Workers Version/Preview URLs are public unless Access protects them; they share production bindings | developers.cloudflare.com/workers/versions-and-deployments/version-urls/ · A (quoted by reviewer) · 2026-10-13 |
| F8 | D1 free plan: 100k rows written/day per **account**; hitting it blocks all D1 queries | developers.cloudflare.com/d1/platform/pricing/ · A (quoted by reviewer) · 2026-10-13 |
| F9 | Link targets resolve: flowgt.co.nz, loyalasabook.com, cita.org.nz, themuse.org.nz, github.com/GabrielPower1969 | HTTP fetch of each `<title>` · A · 2026-10-13. LinkedIn URL blocks bots (HTTP 999) · C |
| F10 | Bio facts (roles, years, degree, prior employers) | Gabriel's own CV notes (private, not in repo) · C until Gabriel approves the copy |

---

## 2. Information architecture

```
/                 Home (EN)                 /zh/                 Home (ZH)
/writing          All posts                 /zh/writing
/writing/<slug>   One post                  /zh/writing/<slug>   (302 → EN if no ZH translation)
/privacy          Analytics notice, opt-out /zh/privacy
/rss.xml          EN posts                  /zh/rss.xml          ZH posts
/sitemap.xml      generated from D1 (on demand), with hreflang alternates
/robots.txt, 404 (real 404 status, per locale), 410 for archived posts
/admin, /admin/*  private — Cloudflare Access + JWT verification in the Worker
/api/t            analytics beacon (public, guarded)
/api/admin/*      admin JSON API (Access + JWT + Origin check)
/media/<key>      cover images from R2
```

### 2.1 Header (exactly the brief)
Left: wordmark **onemorething.** = Home. Right: `flowgt ↗` · `loyalasabook ↗` · GitHub · LinkedIn · `EN / 中`.
`Writing` joins the header once ≥ 1 post is published (`FEATURES.writingInHeaderMinPosts`); Home
links to it from the Writing section regardless. On Home the wordmark stays hidden until the
Overture scrolls away (no "one more thing" twice on screen). ↗ is an SVG icon (Newsreader has no
U+2197 glyph). Mobile: wordmark, `EN / 中`, `Menu` → full-screen sheet (aria-expanded, focus trap,
Esc closes, background `inert`, focus returns on close). All tap targets ≥ 44×44.

### 2.2 Home — narrative order (design review #3)
1. **Overture** (100svh): `One more thing` + breathing dot (the period). Types in ≤ 1.5 s.
2. **Hello**: `I'm *Gabriel Chen*.` · one-line role · short bio. Fades in, not typed.
3. **Work**: Flowgt · loyalasabook · Trimble · CITANZ · The Muse — name, role · years, one line, ↗ always visible.
4. **Writing**: latest 3 posts (text rows) + "All writing". Hidden if no posts. (r3: no featured video — Gabriel, "too complex".)
5. **One more thing** — a hard-edged black stage, five typed lines, sources disclosure.
   Placed at the end on purpose: the best part comes last, and line 5 hands off to Contact.
6. **Contact**: `Say hello.` · `gabriel@onemorething.today` (mailto + copy with aria-live feedback) · icons.

### 2.3 Writing list (v1 = text rows)
Date · title · kind (Words/Video/Audio) · "中文"/"English" tag when only in the other language.
No thumbnails, no filter chips, no pagination until > 20 posts.

### 2.4 Post page
Text: 640px measure, Newsreader 20/32. Video: facade (16:9 reserved, greyscale poster, monochrome
play glyph, `<button aria-label="Play: {title}">`, iframe `youtube-nocookie.com` only after click).
Audio: 1:1 cover, "Listen ↗" external link, or `<audio>` when the URL is a direct .mp3/.m4a.
Footer: copy link, prev/next, link to the other language when it exists.

---

## 3. Design system — Figma first

Figma file **"onemorething.today — v1"** (Gabriel's Figma drafts). Pages: Explorations (type
specimen), Tokens & Components, Desktop, Mobile, Admin, Motion notes.

- **Tokens** = Figma variables `omt/color` and `omt/space` → `src/styles/tokens.css` (same names).
  `--paper #FAFAF7`, `--ink #111`, `--ink-2 #6B6B6B`, `--hair #E4E4E0` (never for input borders),
  `--stage #000`, `--stage-ink #F5F5F2`, `--stage-ink-2 #8A8A86`. No accent colour, no dark mode.
- **Type:** **Newsreader** (variable, optical size axis, real italics) chosen over Libre Caslon after
  a specimen in Figma — closest to LoveFrom's high-contrast serif, and one family covers 112px
  display to 17px body. Chinese: **Noto Serif SC**. `font-synthesis: none`. On `/zh/`, CJK
  punctuation (— “ ” …) always comes from Noto Serif SC via a `unicode-range`-limited Latin alias.
  Chinese italics render upright. `:lang(zh-Hans) { text-autospace: normal }`.
- **Motion — exactly three things:** (1) typing (Overture + stage lines only, once per session,
  `Intl.Segmenter` steps, pauses on `. , — ，。、：；——`), (2) the breathing dot (only while the
  Overture is in view), (3) link underline draw. Everything else is a plain opacity fade.
  `prefers-reduced-motion` → no typing, static dot, no fades.
- **Typing technique (a11y/CLS/LCP-safe):** full text is server-rendered and visible to AT and
  crawlers. A hashed inline head script adds `.typing` only on the first view per session; the
  line is split into exactly two spans (typed part + `color: transparent` remainder), so layout
  is final from the first frame. The caret is `aria-hidden` and fades 2 s after typing ends.
- **Focus:** 2px solid ink outline, 3px offset (inverted on the black stage).

Frames delivered: Home EN desktop/mobile, Home ZH desktop, mobile menu sheet, Writing list,
Post (text), Post (video), 404, components (headers, work row, post row, video facade, lang toggle,
12 icons). Admin is built from the same tokens in code (release review #11).

---

## 4. Content and i18n

### 4.1 Files and enforcement
```
src/i18n/en.ts        source of truth (as const); the Messages type is derived from it
src/i18n/zh.ts        `const zh: Messages` → missing or extra keys are compile errors
src/i18n/locales.ts   every language code (html, hreflang, og, rss, Intl) + Pacific/Auckland time zone
src/i18n/index.ts     useT(locale), rich() (*emphasis* only), plain(), formatDate()
src/config/site.ts    every URL once, work ids/years, socials, feature flags
```
Gates: (1) TypeScript; (2) `scripts/i18n-check.mjs` — key parity, no empty/TODO, matching
`{placeholders}`, every `WORK` id has its keys, ZH typography (no ASCII quotes, no spaces around
——, no typed CJK–Latin spaces except in plain-text `meta.*`/`rss.*`); (3) e2e "i18n leak" crawl
of rendered EN/ZH pages (title, meta, OG, JSON-LD, alt, aria-label, visible text). Admin UI is
English-only by decision (single user) and out of scope for the gates.

### 4.2 Alternates and language switching (`src/i18n/alternates.ts`)
hreflang only for translations that exist, both directions; `x-default` → EN. Toggle → counterpart
if it exists, else the other language's Writing index. Canonical built from `SITE.origin`, never the
request host. Non-production hosts send `X-Robots-Tag: noindex`. No server-side language
negotiation at all.

### 4.3 Story copy (sourced)
EN: `January 6, 1998. Macworld Expo, San Francisco.` / `Steve Jobs ended his keynote with a
surprise: Apple was profitable again.` / `In the years that followed, the surprise got a name —
"One more thing."` / `The best part was never on the agenda.` / `This is mine. *One more thing, today.*`

| Line | Source · level · checked |
|---|---|
| 1–2 | TidBITS, "Jobs Announces $45 Million Profit", 6 Jan 1998 (same-day report: Jobs "did end the presentation with a surprise: Apple expects to post a quarterly profit of $45 million") · B · 2026-10-13 |
| 3 | Wikipedia "Stevenote" § One more thing…: 1998 MacWorld SF listed first, worded "One last thing…" · C · 2026-10-13 |
| 4–5 | Gabriel's voice, not a factual claim |

### 4.4 Public-data rule
No phone, home address, visa status, family, school or church on the site or in the repo. The
repo is public: no personal emails, no private file paths, no admin/dashboard screenshots.

---

## 5. Architecture

Cloudflare Workers + static assets, Astro 7 (`@astrojs/cloudflare` 14), D1 `omt`, R2 `omt-media`.

| Concern | Decision |
|---|---|
| Rendering | Prerender what doesn't touch D1 (privacy). Home/Writing/posts render on demand from D1; **no edge caching in v1** (Workers run before the cache; Astro's Cloudflare cache provider is experimental — revisit in v1.1 with `cacheCloudflare()` + tag purge) |
| Degradation | Home must render without D1 (Writing section disappears, nothing else changes). Post pages return a styled 503 |
| Bindings | `import { env } from "cloudflare:workers"`; `session: false`; `imageService: "passthrough"` |
| Admin auth | Cloudflare Access on `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*` (no-wildcard parents listed explicitly) + Worker verifies `Cf-Access-Jwt-Assertion` with `jose` (`iss`, `aud`, JWKS). Fails closed if `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are missing. Dev bypass only when `import.meta.env.DEV && hostname === "localhost"`. `run_worker_first` for `/admin*` and `/api/*`; admin routes never prerendered; `Cache-Control: private, no-store` |
| CSRF | Astro `checkOrigin` (default on) + explicit Origin check on `/api/admin/*` |
| CSP | Astro `security.csp` (hashed scripts/styles in a meta tag) + header-only directives (`frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy) from middleware |
| Markdown | `marked` with raw HTML disabled → `xss` allowlist (http/https/mailto only, `rel="noopener nofollow"`) at save time; stored with `sanitizer_version`; admin preview uses the same function |
| Uploads | `image/jpeg|png|webp|avif` by magic bytes, ≤ 5 MB, random key, no SVG; `/media/*` served with `nosniff`, `default-src 'none'`, `immutable` |
| Preview hosts | `workers_dev: false`; preview URLs only behind Access; previews share prod bindings → never used for admin writes |

### 5.1 D1 schema (`migrations/0001_init.sql`)
```sql
posts(id TEXT PK /*uuid*/, slug TEXT UNIQUE NOT NULL, kind TEXT NOT NULL /*text|video|audio, checked in code*/,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      cover_key TEXT, youtube_id TEXT, media_url TEXT, published_at TEXT, created_at TEXT, updated_at TEXT)
post_i18n(post_id TEXT REFERENCES posts(id) ON DELETE CASCADE, lang TEXT CHECK(lang IN ('en','zh')),
      title TEXT, summary TEXT, body_md TEXT, body_html TEXT, sanitizer_version INTEGER, cover_alt TEXT,
      PRIMARY KEY (post_id, lang))
media(key TEXT PK, content_type TEXT, bytes INTEGER, width INTEGER, height INTEGER, created_at TEXT)
settings(key TEXT PK, value TEXT /*JSON*/)        -- reserved; unused since r3
events(id INTEGER PK, ts INTEGER, type TEXT, path TEXT, lang TEXT, ref TEXT, campaign TEXT,
       target TEXT, section TEXT, country TEXT, device TEXT, app TEXT, visitor TEXT, version TEXT)
daily_salt(day TEXT PK, salt TEXT)               -- rows older than 48 h deleted
CREATE INDEX posts_status_pub ON posts(status, published_at DESC);
```
`events` deliberately has **no secondary index** (each index = one more row write, F8).

---

## 6. Admin (`/admin`)

Dashboard (visitor-days, visits, engaged visits, Work reach, top pages, referrers/apps, outbound
clicks, EN/ZH split) · Posts list · Editor (Words/Video/Audio; EN | 中 tabs with a completeness
dot; markdown with live sanitized preview; slug; cover upload; YouTube or audio URL with instant
validation; publish date; drafts saved to D1 every 10 s, `localStorage` as crash buffer; refuses
to publish a language without title, summary and cover alt).
Soft delete = `status='archived'` (public URL returns 410).

---

## 7. Analytics (first-party, cookieless, opt-out)

| `type` | When |
|---|---|
| `pageview` | load (after `prerenderingchange`, never for prerendered-but-unseen pages) |
| `section` | a Home scene ≥ 50% visible for ≥ 1.5 s (`hello`, `work`, `writing`, `stage`, `contact`) |
| `engage` | visible seconds, sent on `visibilitychange → hidden` |
| `out` | external link click; `target` = config id, `section` = where it was |
| `email` | mailto click or copy |
| `lang` | toggle |
| `play` | video facade / audio play |
| `read` | post scroll depth 90% |

Server adds `country`, coarse `device`, `app` (WeChat/LinkedIn in-app from UA), referrer **host**,
`campaign` (group-level `?r=` codes from `site.ts`, removed from the URL with `replaceState`), Worker
`version`. `visitor = sha256(daily_salt ‖ ip ‖ ua)[0:16]`; the salt is 32 random bytes per NZ day in
`daily_salt`, deleted after 48 h, so hashes cannot be recomputed later.
Guards: JS-only beacon, `isbot` UA list, `navigator.webdriver` dropped, `Sec-Fetch-Site: same-origin`,
allowed-value checks on `type/target/path`, 1 KB body limit, rate-limit binding (noise filter only),
only counted on the production host, writes via `waitUntil`.
Privacy: notice page (EN/ZH) linked in the footer, opt-out toggle (`localStorage`) and `Sec-GPC: 1`
honoured, raw events kept ≤ 13 months (well under CNIL's 25-month limit), no third-party scripts
(Cloudflare Web Analytics dropped). Metric definitions in `docs/METRICS.md`.

Risk accepted for v1 (F8): a deliberate flood could exhaust the free D1 write quota for a day;
Home degrades gracefully. **Gabriel decides** whether to move to Workers Paid ($5/month), which
removes this risk (see §12).

---

## 8. Quality gates

`npm run check` (local + GitHub Actions, no Cloudflare secrets): i18n-check → `astro check` → Vitest
(YouTube parser, slug, sanitizer XSS corpus, visitor hash, alternates, Access JWT negatives: no token /
wrong aud / expired / foreign key → 403, upload magic bytes incl. SVG/polyglot rejects, Origin check).
`npm run e2e` against a production build served by `wrangler dev`: smoke on every page type, language
round-trip, reduced motion shows full text, zero console errors, axe on every page state (menu open,
black stage, admin), i18n leak crawl, approved screenshots as `toHaveScreenshot` baselines
(1440 + 390, EN + ZH). Lighthouse on the preview: desktop ≥ 95, mobile ≥ 90, LCP ≤ 2.5 s,
CLS ≤ 0.02, CJK fonts ≤ 300 KB on first view. CI also runs `docker compose up` + curl on Ubuntu.

---

## 9. Release — 灰度 as staged audiences

| Stage | Audience | How |
|---|---|---|
| 0 | Gabriel only, local | `npm run dev` / built preview on localhost; screenshots |
| **Gate A** | — | **Gabriel approves design + copy** |
| 1 | Gabriel only, real domain | Custom domain attached, site-wide Access app (Gabriel's email), `noindex` |
| 2 | Friends (soft launch, 3–7 days) | Access allowlist of invited emails, still `noindex`; watch logs + beacon |
| **Gate B** | — | zero 5xx, zero console errors, copy final |
| 3 | Public | Remove site-wide Access (keep `/admin*`), drop `noindex`, submit sitemap, tag `v1.0.0` |
| Kill switch | — | Re-enable site-wide Access (instant private) or `wrangler rollback <id>` |

Later releases: `wrangler versions upload` → smoke + axe + Lighthouse against the Access-protected
preview → deploy 100% → rollback ready. Percentage splits only once traffic is meaningful, with the
`Cloudflare-Workers-Version-Key = ip.src` Transform Rule for version affinity.
Before each migration the release script records the D1 Time Travel bookmark. Schema changes go
expand → contract across two releases. `docs/RELEASES.md` logs version, bookmark and command.

### Backup
`scripts/backup.sh` → `$BACKUP_DIR/omt-YYYYMMDD.tar.gz` (outside the repo by default): `d1 export` +
R2 objects listed from the `media` table + `wrangler.jsonc`. Weekly (inside the free 7-day Time
Travel window). One restore drill before public launch.

---

## 10. Repo conventions
English README with "中文速览" · root `CLAUDE.md` (commands, map, invariants, verification),
updated in the same commit as architecture changes · English code/comments/commits ·
`compose.yaml` (`node:22-slim`, `user: ${OMT_UID:-1000}:${OMT_GID:-1000}`) running the dev server,
verified on GitHub's Ubuntu runner (Docker is not installed on this Mac) · deploys from the Mac
(`npm run release`), CI only checks · MIT for code, all rights reserved for content.

---

## 11. Milestones
| M | Deliverable | Gate |
|---|---|---|
| M0 | Plan r1 → 4 reviews → r2 | done |
| M1 | Figma design (§3) | shown to Gabriel with M2 |
| M2 | Public site + i18n + beacon + admin, local, seeded with **local-only** sample posts | — |
| M3 | Gates in §8 green, screenshots, local preview | **Gate A** |
| M4 | Stages 1–2 | Access set up by Gabriel |
| M5 | Stage 3 public launch | **Gate B** |

## 12. Decisions and actions only Gabriel can take
1. Approve copy: bio, work roles/years/order, story lines, Chinese name 陈广宇 on `/zh/`.
2. Workers Free (accept §7 risk) vs Paid ($5/month; also 30-day Time Travel).
3. Cloudflare Zero Trust: create the team and the Access apps (dashboard only; click-by-click provided).
4. Friends allowlist for stage 2; where backups go; GitHub push protection on.
5. Search Console / Bing verification at stage 3. Any extra profiles (YouTube, X, RED, Bilibili).

## 13. Audit — weakest points
| Claim | Level | Why weak | Verify by |
|---|---|---|---|
| LinkedIn URL | C | LinkedIn blocks bots; taken from Gabriel's CV | Gabriel opens it once |
| Story line 3 wording history | C | Wikipedia only | Watch the end of the Macworld SF 1998 keynote; line 3 is phrased to stay true either way |
| Bio roles/years (F10) | C | from private CV notes, one known date conflict between CV versions | Gabriel approves the copy |
| Astro `security.csp` with on-demand pages on Workers | D | read from type docs, not yet exercised | build + inspect response headers/meta in e2e |

## 14. Review log (r1 → r2)
Design: typing limited to Overture + stage, once per session; new order with the stage last; header
trimmed to the brief; stage = hard black section; Newsreader replaces Libre Caslon; CJK punctuation
alias; motion reduced to three; a11y specifics; text-only Writing list; admin drafts in D1.
Architecture: Astro 7 bindings API; no edge caching in v1; Access path/bypass hardening;
`run_worker_first`; CSP via `security.csp`; schema fixes (archived, FK, index, no events indexes);
D1 write quota risk surfaced; salt storage; upload/R2 headers.
i18n/SEO/analytics: typed TS locale files + literal lint + rendered leak crawl; D1-generated sitemap;
alternates rules; locale code table; NZ time zone; analytics events for "does Work get read";
opt-out + GPC + retention; metric definitions; ZH typography rules.
Release/QA: personal data scrubbed from this file; previews are public → approval happens on
localhost; 灰度 = staged audiences; F2/F3 corrected; CI = checks only; tests added; backups fixed.
Rejected: none outright. Deferred to v1.1: edge caching, Bilibili, OG images per post, WAE sink.

r2 → r3 (Gabriel's preview feedback, 2026-10-13): Home was too complex — the featured video block is
removed from Home, and with it the admin Settings page and `/api/admin/settings`. Video posts stay.
