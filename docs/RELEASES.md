# Releases

| Date (NZ) | Version | Worker version id | D1 bookmark (if migration) | Stage | Notes |
|---|---|---|---|---|---|
| 2026-10-13 | v0.1.0 | — | — | local preview | Design + build complete (Gate A review) |
| 2026-10-13 | v1.0.0 | 7782407e-0931-48bc-9109-0f3f8b7a9af3 | new database (0001_init) | public | Gabriel approved "直接上线": skipped the friends-only stage. Custom domains apex + www. Admin locked until Cloudflare Access is configured |
| 2026-10-13 | v1.0.1 | 3b93d68c-5493-4dbf-a133-b79741d83235 | — | public | `Cache-Control: no-transform` on HTML: stops Cloudflare auto-injecting its Web Analytics beacon (blocked by CSP, contradicts the privacy notice) |
| 2026-10-13 | v1.0.2 | ec4df13a-ff83-4f38-a2ab-8862ee49ecb8 | — | public | Security parity with flowgt/loyalasabook (docs/SECURITY.md): Worker-first secure() for every response, http→https, HSTS preload, XFO DENY, COOP/CORP, upgrade-insecure-requests, security.txt, admin rate limit, hygiene scan in CI. `npm run security:check`: 26/26 |
