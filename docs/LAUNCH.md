# Launch runbook — staged release (灰度)

Gray release for a brand-new site means **staged audiences**, not traffic percentages
(docs/PLAN.md §9). Every step has a kill switch: re-enable the site-wide Access app (site goes
private instantly) or `npx wrangler rollback <version-id>`.

> Cloudflare dashboard labels below are from memory (level D) — if a label differs, the setting
> name is what matters. Steps marked **Gabriel** need his Cloudflare login; the rest can be run
> from this repo.

## 0 · Gate A — design and copy approved
Screenshots + local preview reviewed; copy in `src/i18n/*.ts` and `src/config/site.ts` approved.

## 1 · Provision (once)
```bash
scripts/provision.sh          # creates D1 "omt" + R2 "omt-media", writes the D1 id into wrangler.jsonc
npx wrangler d1 migrations apply omt --remote
```

## 2 · Cloudflare Access (Gabriel, dashboard)
1. Zero Trust → create a team (free plan) — note the team domain, e.g. `gabriel.cloudflareaccess.com`.
2. Access → Applications → Add → **Self-hosted**, name `omt admin`, add these destinations
   (wildcards don't cover the parent path, so list both):
   `onemorething.today/admin`, `onemorething.today/admin/*`, `onemorething.today/api/admin`, `onemorething.today/api/admin/*`.
3. Policy: Allow → Emails → your own address only. Login method: one-time PIN.
4. Copy the application's **AUD tag**.
5. Second application `omt site (pre-launch)` on `onemorething.today` (whole site) with the same
   policy — this is the stage-1/2 privacy screen and the kill switch.
6. Put both values in `wrangler.jsonc` → `vars.ACCESS_TEAM_DOMAIN` / `vars.ACCESS_AUD` (not secret).

## 3 · Stage 1 — Gabriel only, real domain
```bash
npm run check && npm run build
npx wrangler deploy
```
Attach custom domains: Workers → onemorething → Settings → Domains → add `onemorething.today` and
`www.onemorething.today` (the middleware 301s www → apex).
Smoke: `/` loads behind Access; `/admin` asks for the PIN; `curl -I https://onemorething.today/api/admin/posts` → 403 without a token;
one beacon row appears (`npx wrangler d1 execute omt --remote --command "SELECT COUNT(*) FROM events"`);
a cover upload works; a test mail to gabriel@onemorething.today arrives.

## 4 · First real posts + backup drill
Publish 1–3 real posts in `/admin`. Then `BACKUP_DIR=… scripts/backup.sh` and restore it once into a
scratch database (see Restore) to prove the backup works.

## 5 · Stage 2 — friends (3–7 days)
Edit the site-wide Access policy to include the invited emails. Crawlers can't get past Access,
so nothing is indexed before stage 3. Watch Workers → Logs and `/admin` daily.
Fixes go through `npm run check` → deploy → smoke.

## 6 · Gate B → Stage 3 — public
Go/no-go: zero 5xx in logs, zero console errors, copy final. Then:
1. Delete the `omt site (pre-launch)` Access application (keep `omt admin`).
2. Confirm a private window sees the site, and `/admin` still asks for the PIN.
3. Submit `https://onemorething.today/sitemap.xml` in Google Search Console and Bing Webmaster.
4. `git tag v1.0.0 && git push --tags`, log the version in `docs/RELEASES.md`.

## Later releases
```bash
npm run check
npx wrangler d1 time-travel info omt          # record the bookmark if a migration ships
npx wrangler d1 migrations apply omt --remote # additive only
npm run build && npx wrangler versions upload # then smoke the version
npx wrangler versions deploy                  # 100 %; percentage splits only once traffic exists
npm run security:check                        # live headers, redirects, security.txt, admin lock
```
Rollback: `npx wrangler rollback <previous-version-id>`. Data: `npx wrangler d1 time-travel restore omt --bookmark <id>`.

## Restore (from scripts/backup.sh output)
```bash
tar -xzf omt-YYYYMMDD.tar.gz -C /tmp/omt-restore
npx wrangler d1 execute omt --remote --file /tmp/omt-restore/omt.sql      # into an empty database
for f in /tmp/omt-restore/media/*; do npx wrangler r2 object put "omt-media/$(basename "$f")" --file "$f" --remote; done
npm run build && npx wrangler deploy
```
