# onemorething.today

陈广宇（Gabriel Chen）的个人主页、作品集和博客 —— <https://onemorething.today>

白底黑字，一种衬线字体，一个安静的动画。英文版在 `/`，中文版在 `/zh/`，右上角切换。
私有后台 `/admin` 用来发文章（文字、YouTube 视频、音频链接，都可以配封面），并查看不使用 Cookie 的第一方访问统计。

- 设计稿：Figma 文件「onemorething.today — v1」
- 方案与评审记录：[`docs/PLAN.md`](docs/PLAN.md)
- 上线手册：[`docs/LAUNCH.md`](docs/LAUNCH.md) · 发布记录：[`docs/RELEASES.md`](docs/RELEASES.md) · 统计口径：[`docs/METRICS.md`](docs/METRICS.md)

## 技术栈

| 部分 | 选型 |
|---|---|
| 框架 | [Astro 7](https://astro.build)，部署在 **Cloudflare Workers**（`@astrojs/cloudflare` 14） |
| 数据 | **D1** 存文章、统计事件；**R2** 存封面图 |
| 后台登录 | **Cloudflare Access** 挡在 `/admin` 前面，Worker 里再校验一次 JWT（没配置就一律拒绝） |
| 字体 | 英文 Newsreader、中文思源宋体（Noto Serif SC），全部自托管 |
| 前端脚本 | 不用框架，每页一个很小的原生 JS 模块 |

## 本地运行

```bash
npm install
npm run db:migrate:local     # 建本地 D1 表结构
npm run dev                  # http://localhost:4321（本机访问 /admin 免登录）
node scripts/seed-local.mjs  # 可选：灌几篇本地示例文章（只写本地，不会上线）
```

也可以用 Docker（Linux / macOS）：

```bash
docker compose up -d         # http://localhost:4321
```

## 检查

```bash
npm run check                # 多语言检查 + 类型检查 + 单元测试
npm run e2e                  # Playwright：冒烟、无障碍（axe）、中文页漏英文检查（需先 npm run dev）
npm run build && npx astro preview --port 4322
BASE_URL=http://localhost:4322 npm run e2e   # 对生产构建（含严格 CSP）再跑一遍
```

## 文案与多语言

- 所有对外文字都在 `src/i18n/en.ts` 和 `src/i18n/zh.ts`。中文文件少一个键或多一个键都会编译失败；
  `npm run i18n:check` 还会检查占位符、中文标点（全角引号、破折号）等规则。
- 所有外链（作品、社交账号、邮箱）只在 `src/config/site.ts` 出现一次。作品顺序也在这里改。
- 文章在 `/admin` 里写，可以只写一种语言；访问另一种语言的地址会自动跳到有内容的那一版。

## 部署

部署只从维护者本机执行，CI 只做检查、不持有任何 Cloudflare 密钥。

```bash
npm run check && npm run build
npx wrangler deploy
```

首次上线、后台登录（Cloudflare Access）设置、回滚都写在 [`docs/LAUNCH.md`](docs/LAUNCH.md)。每次发布记一行到 [`docs/RELEASES.md`](docs/RELEASES.md)。

## 备份与恢复

```bash
BACKUP_DIR=~/Backups/omt scripts/backup.sh   # 导出 D1 + 全部封面 + wrangler.jsonc，打成带日期的压缩包
```

恢复 = 把 SQL 导入 D1、把封面放回 R2、重新部署。具体命令见 `docs/LAUNCH.md` 的「Restore」一节。

## 目录速查

```
src/config/site.ts     外链、作品列表、社交账号、功能开关
src/i18n/              中英文案、语言代码、hreflang 规则
src/views/             页面主体（中英路由共用）
src/pages/             路由；/zh/* 额外加载中文字体
src/lib/               服务端逻辑：文章、Markdown 过滤、后台鉴权、统计
src/scripts/           浏览器端脚本：打字动画、埋点、后台编辑器
migrations/            D1 表结构（同一版本内只加不删）
scripts/               多语言检查、截图、备份、开通资源等脚本
tests/                 单元测试（vitest）与端到端测试（Playwright）
```

给 AI 助手和新协作者的规则说明见 [`CLAUDE.md`](CLAUDE.md)。

## 许可

代码：MIT。文字、图片与设计：© 陈广宇，保留所有权利。

---

## English summary

Personal homepage, portfolio and blog of Gabriel Chen — Astro 7 on Cloudflare Workers with D1, R2 and
Cloudflare Access. English at `/`, Chinese at `/zh/`. Run locally with `npm install && npm run db:migrate:local && npm run dev`
(or `docker compose up -d`); check with `npm run check` and `npm run e2e`; deploy with `npx wrangler deploy`
following `docs/LAUNCH.md`. Code is MIT; words, images and design © Gabriel Chen.
