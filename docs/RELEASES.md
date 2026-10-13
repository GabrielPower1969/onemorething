# Releases

| Date (NZ) | Version | Worker version id | D1 bookmark (if migration) | Stage | Notes |
|---|---|---|---|---|---|
| 2026-10-13 | v0.1.0 | — | — | local preview | Design + build complete (Gate A review) |
| 2026-10-13 | v1.0.0 | 7782407e-0931-48bc-9109-0f3f8b7a9af3 | new database (0001_init) | public | Gabriel approved "直接上线": skipped the friends-only stage. Custom domains apex + www. Admin locked until Cloudflare Access is configured |
| 2026-10-13 | v1.0.1 | 3b93d68c-5493-4dbf-a133-b79741d83235 | — | public | `Cache-Control: no-transform` on HTML: stops Cloudflare auto-injecting its Web Analytics beacon (blocked by CSP, contradicts the privacy notice) |
