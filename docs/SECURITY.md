# Security

How onemorething.today is protected, and where each measure comes from. Baseline: everything
flowgt.co.nz and loyalasabook.com do that applies to a site with no visitor accounts and no forms.
Verify the live site any time with `npm run security:check` (exit 1 on any failure).

Reported vulnerabilities: see `/.well-known/security.txt` (gabriel@onemorething.today).

## In code (applies to every response — `src/worker.ts` → `src/lib/secure.ts`)

| Measure | Value | Reference |
|---|---|---|
| Every request through the Worker | `assets.run_worker_first: true`; static files get the same headers | loyalasabook (`run_worker_first = true`) |
| HTTPS + canonical host | `http://` and `www.` → one 301 to `https://onemorething.today` | loyalasabook |
| HSTS | `max-age=31536000; includeSubDomains; preload` (https production only) | loyalasabook |
| CSP (pages) | Astro hashed `script-src`/`style-src` (no `'unsafe-inline'`) + `frame-ancestors 'none'; upgrade-insecure-requests` | loyalasabook (stricter: no unsafe-inline) |
| CSP (files, JSON) | `default-src 'none'; frame-ancestors 'none'`; `/media/*` adds `sandbox` | ours |
| Framing | `X-Frame-Options: DENY` | loyalasabook (flowgt uses SAMEORIGIN) |
| Isolation | `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` (no COEP: it would break the YouTube player) | loyalasabook |
| Other headers | `nosniff`, `strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic, geolocation, payment, usb, FLoC off) | both |
| No edge rewriting | HTML `Cache-Control: … no-transform` (blocks Cloudflare's auto-injected analytics beacon) | ours |
| security.txt | `/.well-known/security.txt` (+ `/security.txt` → 301); unit test fails 30 days before `Expires` | loyalasabook |
| Search | `X-Robots-Tag: noindex` on admin/API and any non-production host; `robots.txt` disallows `/admin`, `/api/` | both |
| CORS | none sent → browsers allow same-origin only | loyalasabook |
| Admin auth | Cloudflare Access + JWT check in the Worker (RS256, `iss`, `aud`, JWKS); fails closed when unconfigured; dev bypass only on localhost in `astro dev` | ours (loyalasabook uses Access for its LAN mode) |
| CSRF | Astro `checkOrigin` + explicit same-origin check on admin writes | both |
| Rate limits | beacon 60/min/IP (`BEACON_RL`), admin API 120/min/IP (`ADMIN_RL`) | loyalasabook (`RL_API`) |
| Body limits | beacon 1 KB, admin JSON 512 KB, uploads 5 MB | both |
| Uploads | magic-byte sniffing, JPEG/PNG/WebP/AVIF only, never SVG, random keys | flowgt (attachment checks) |
| Markdown | `marked` (raw HTML dropped) → `xss` allowlist; http/https/mailto only | ours |
| Privacy | no IP stored; daily-salted visitor hash, salt deleted after 48 h; raw events kept ≈13 months | flowgt (IP hashing, retention) — stricter than loyalasabook (raw IP) |
| Errors | API returns error codes only; details go to Workers Logs | loyalasabook |

## In the repository

| Measure | Where | Reference |
|---|---|---|
| Secret + personal-data scan of tracked files | `npm run hygiene` (in `npm run check`) | loyalasabook `test_data_hygiene`, flowgt `no-member-data` |
| Secret scan of the whole git history | CI: `node scripts/hygiene.mjs --history` with full checkout | loyalasabook (`fetch-depth: 0`) |
| Private terms (address, IDs) checked without committing them | `OMT_DENYLIST=~/.config/omt/denylist.txt npm run hygiene` | ours |
| Owner review | `.github/CODEOWNERS` | flowgt |
| No secrets in git | only `vars` that are not secret; `.dev.vars` ignored | both |
| CI holds no Cloudflare credentials | deploys only from the owner's machine | ours |

## Cloudflare dashboard — owner actions (the deploy token cannot change zone settings)

| Setting | Target | Why | Status |
|---|---|---|---|
| SSL/TLS → Edge Certificates → **Minimum TLS Version** | TLS 1.2 | flowgt.co.nz refuses TLS 1.1; this zone still accepts it | **to do** |
| SSL/TLS → Edge Certificates → **Always Use HTTPS** | On | the Worker already redirects; this covers anything that never reaches it | optional |
| Security → Bots → **Bot Fight Mode** | On | recommended in loyalasabook's docs; verified bots (Google, LinkedIn previews) are not blocked | **to do** |
| DNS → **DMARC** TXT `_dmarc` | start `v=DMARC1; p=none; rua=mailto:gabriel@onemorething.today`, then tighten | loyalasabook uses `p=reject` because it sends no mail; this domain receives mail and may send as gabriel@ via Gmail, so `reject` could bounce your own mail until alignment is checked | **to do** |
| HSTS preload submission | hstspreload.org | eligible once the headers above are live; hard to undo (all subdomains must stay HTTPS) | owner's choice |
| Zero Trust → **Access** app for `/admin*`, `/api/admin*` | your email, one-time PIN | unlocks the admin (it is locked until then) | **to do** |
| DNSSEC | On | none of the three zones has it yet; one click if the registrar is Cloudflare | optional |
