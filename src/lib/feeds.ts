import { env } from "cloudflare:workers";
import { escapeHtml, messagesFor } from "../i18n";
import { LOCALES, localePath, type Locale } from "../i18n/locales";
import { absolute, hreflangLinks } from "../i18n/alternates";
import { listPublished } from "./posts";

const xml = (body: string, type: string) =>
  new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=600" } });

/** RSS per language: a feed carries only posts written in its language (docs/PLAN.md §2). */
export async function rss(lang: Locale): Promise<Response> {
  const m = messagesFor(lang);
  let items = "";
  try {
    const posts = (await listPublished(env.DB, lang, 50)).filter((p) => !p.isOtherLang);
    items = posts
      .map(({ post, t }) => {
        const url = absolute(localePath(lang, `/writing/${post.slug}`));
        return `<item><title>${escapeHtml(t.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid>${
          post.published_at ? `<pubDate>${new Date(post.published_at).toUTCString()}</pubDate>` : ""
        }<description>${escapeHtml(t.summary)}</description></item>`;
      })
      .join("");
  } catch (err) {
    console.error(JSON.stringify({ msg: "rss-d1-unavailable", error: String(err) }));
  }
  const self = absolute(localePath(lang, "/rss.xml"));
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeHtml(
      m.rss.title,
    )}</title><link>${absolute(localePath(lang, "/"))}</link><description>${escapeHtml(m.rss.description)}</description><language>${
      LOCALES[lang].rss
    }</language><atom:link href="${self}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`,
    "application/rss+xml",
  );
}

/** Sitemap from D1 (on-demand pages are invisible to @astrojs/sitemap), with hreflang alternates. */
export async function sitemap(): Promise<Response> {
  type Entry = { path: string; available: Locale[]; lastmod?: string };
  const entries: Entry[] = [
    { path: "/", available: ["en", "zh"] },
    { path: "/writing", available: ["en", "zh"] },
    { path: "/privacy", available: ["en", "zh"] },
  ];
  try {
    const posts = await listPublished(env.DB, "en", 1000);
    for (const { post } of posts) {
      const available = (["en", "zh"] as Locale[]).filter((l) => post.i18n[l]?.title);
      entries.push({ path: `/writing/${post.slug}`, available, lastmod: post.updated_at });
    }
  } catch (err) {
    console.error(JSON.stringify({ msg: "sitemap-d1-unavailable", error: String(err) }));
  }
  const urls = entries
    .flatMap((e) =>
      e.available.map((lang) => {
        const alts = hreflangLinks({ locale: lang, path: e.path, available: e.available })
          .map((l) => `<xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${l.href}"/>`)
          .join("");
        return `<url><loc>${absolute(localePath(lang, e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ""}${alts}</url>`;
      }),
    )
    .join("");
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    "application/xml",
  );
}

