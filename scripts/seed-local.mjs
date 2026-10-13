#!/usr/bin/env node
// Seeds LOCAL sample content through the admin API (so markdown is sanitized and the YouTube
// poster is copied into local R2 exactly like production). Refuses any non-localhost target.
//   npm run dev   (in another terminal)
//   node scripts/seed-local.mjs [http://localhost:4321]
const base = process.argv[2] ?? "http://localhost:4321";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("seed-local only talks to localhost.");
  process.exit(1);
}

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const posts = [
  {
    slug: "why-one-more-thing",
    kind: "text",
    status: "published",
    published_at: "2026-10-12T21:00:00.000Z",
    i18n: {
      en: {
        title: "Why this site is called one more thing",
        summary: "A homepage named after the best two seconds of an Apple keynote.",
        body_md: `For years, Apple keynotes followed the same rhythm. Numbers, products, a pause — and then, just when the lights should have come up, a turn back to the audience.

The first time, at Macworld San Francisco in January 1998, there was no product at all. It was one sentence: Apple was profitable again.

What I like about that moment is that it was never on the agenda. It was simply there at the end, for whoever stayed.

> The best part was never on the agenda.

This site works the same way. Most days nothing changes here. Some days there is one more thing — a project, a talk, a note I wanted to keep.

If you read this far, say hello: [gabriel@onemorething.today](mailto:gabriel@onemorething.today).`,
      },
      zh: {
        title: "为什么这个网站叫one more thing",
        summary: "一个以苹果发布会最精彩的两秒钟命名的个人主页。",
        body_md: `很多年里，苹果发布会都是同一个节奏：数字、产品、停顿——然后，就在灯光该亮起的时候，转身面向观众。

第一次是1998年1月，旧金山Macworld大会。那一次没有任何产品，只有一句话：苹果重新盈利了。

我喜欢那个时刻，是因为它从来不在议程上。它只是在最后出现，留给愿意留下来的人。

> 最好的东西，从来不在议程上。

这个网站也是这样。大多数日子这里什么都不变；有些日子，会多出一件事——一个项目、一场分享，或一段我想留下的文字。

如果你读到了这里，来打个招呼吧：[gabriel@onemorething.today](mailto:gabriel@onemorething.today)。`,
      },
    },
  },
  {
    slug: "sample-video-post",
    kind: "video",
    status: "published",
    youtube: "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
    published_at: "2026-10-05T21:00:00.000Z",
    i18n: {
      en: {
        title: "Sample: a video post",
        summary: "Layout preview for video posts — Steve Jobs at Stanford, 2005. Replace before launch.",
        body_md: "This is **sample content** for the design preview. A video post shows its notes here, under the player.",
        cover_alt: "Steve Jobs speaking at Stanford, 2005",
      },
    },
  },
  {
    slug: "sample-audio-post",
    kind: "audio",
    status: "published",
    media_url: "https://example.com/episode-1.mp3",
    published_at: "2026-09-28T21:00:00.000Z",
    i18n: {
      zh: {
        title: "示例：一条音频",
        summary: "音频文章的版式预览（只有中文版）。上线前替换。",
        body_md: "这是用于设计预览的**示例内容**。",
      },
    },
  },
];

for (const p of posts) {
  const { id } = await call("POST", "/api/admin/posts", p);
  console.log(`post ${p.slug} → ${id}`);
}
