# onemorething.today

Gabriel Chen's homepage, portfolio and writing — <https://onemorething.today>.

Black on off-white, one serif, one quiet animation. English at `/`, Chinese at `/zh/`.
A private `/admin` publishes posts (words, YouTube videos, audio links) and shows first-party,
cookieless analytics.

Design: Figma file "onemorething.today — v1". Plan and review log: [`docs/PLAN.md`](docs/PLAN.md).

## Stack

- [Astro 7](https://astro.build) on **Cloudflare Workers** (`@astrojs/cloudflare` 14)
- **D1** for posts, settings and analytics events · **R2** for cover images
- **Cloudflare Access** in front of `/admin` + JWT verification in the Worker
- Newsreader (Latin) + Noto Serif SC (Chinese), self-hosted
- No client framework; one small vanilla module per page

## Run it

```bash
npm install
npm run db:migrate:local     # create the local D1 schema
npm run dev                  # http://localhost:4321 (admin at /admin, no login on localhost)
node scripts/seed-local.mjs  # optional: local sample posts
```

Or with Docker (Linux/macOS):

```bash
docker compose up -d         # http://localhost:4321
```

## Check

```bash
npm run check                # i18n gate + astro check + unit tests
npm run e2e                  # Playwright: smoke, axe, i18n leak crawl (needs `npm run dev`)
npm run build && npx astro preview --port 4322
BASE_URL=http://localhost:4322 npm run e2e   # same suite against the production build + CSP
```

## Content and languages

- Every public string is in `src/i18n/en.ts` / `src/i18n/zh.ts`. A missing or extra key fails the
  type check; `npm run i18n:check` also enforces placeholders and Chinese typography rules.
- Every external URL (projects, profiles, email) is in `src/config/site.ts`.
- Posts are written in `/admin`, in one or both languages. A post that exists in only one language
  redirects there from the other.

## Deploy

Deploys run from a maintainer's machine, never from CI. First launch and every later release follow
[`docs/LAUNCH.md`](docs/LAUNCH.md) (staged: owner only → friends → public). Releases are logged in
[`docs/RELEASES.md`](docs/RELEASES.md).

## Backup and restore

```bash
BACKUP_DIR=~/Backups/omt scripts/backup.sh   # D1 export + every R2 cover + wrangler.jsonc
```

Restore = import the SQL into a D1 database, put the covers back into R2, `npm run build && npx wrangler deploy`.
Step by step in `docs/LAUNCH.md` § Restore.

## Licence

Code: MIT. Words, images and design: © Gabriel Chen, all rights reserved.

---

## 中文速览

**onemorething.today** 是陈广宇（Gabriel Chen）的个人主页、作品集和博客。英文在 `/`，中文在 `/zh/`，右上角切换。

- **技术栈**：Astro 7 + Cloudflare Workers，D1 存文章和统计，R2 存封面，`/admin` 后台由 Cloudflare Access 保护。
- **本地运行**：`npm install` → `npm run db:migrate:local` → `npm run dev`，打开 http://localhost:4321。也可以 `docker compose up -d`。
- **文案与多语言**：所有对外文字都在 `src/i18n/en.ts` 和 `src/i18n/zh.ts`，缺一个键就编译失败；所有外链集中在 `src/config/site.ts`。
- **后台**：`/admin` 写文章（文字 / YouTube 视频 / 音频链接，带封面）、看流量（无 Cookie 的第一方统计）。
- **上线**：按 `docs/LAUNCH.md` 分阶段灰度（仅本人 → 朋友 → 公开），每次发布记在 `docs/RELEASES.md`。
- **备份**：`scripts/backup.sh` 导出 D1 和全部封面；恢复 = 导入 SQL + 放回封面 + 重新部署。
