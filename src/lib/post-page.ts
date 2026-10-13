import { env } from "cloudflare:workers";
import { localePath, otherLocale, type Locale } from "../i18n/locales";
import { getAdjacent, getPublicBySlug, listPublished, type ListedPost, type Post, type Translation } from "./posts";
import { SLUG } from "./posts";

export type PostPageResult =
  | { kind: "ok"; post: Post; t: Translation; available: Locale[]; prev: ListedPost | null; next: ListedPost | null }
  | { kind: "redirect"; to: string }
  | { kind: "gone" }
  | { kind: "notfound" }
  | { kind: "unavailable" };

/**
 * Everything a post URL can resolve to (docs/PLAN.md §2, §4.2):
 * published + translated → ok · published, other language only → 302 to it ·
 * archived → 410 · missing/draft → 404 · D1 down → 503.
 */
export async function loadPostPage(slug: string | undefined, lang: Locale): Promise<PostPageResult> {
  if (!slug || !SLUG.test(slug)) return { kind: "notfound" };
  try {
    const post = await getPublicBySlug(env.DB, slug);
    if (!post) return { kind: "notfound" };
    if (post.status === "archived") return { kind: "gone" };
    const available = (["en", "zh"] as Locale[]).filter((l) => post.i18n[l]?.title);
    const t = post.i18n[lang];
    if (!t?.title) {
      const other = otherLocale(lang);
      return available.includes(other) ? { kind: "redirect", to: localePath(other, `/writing/${slug}`) } : { kind: "notfound" };
    }
    const { prev, next } = await getAdjacent(env.DB, post, lang);
    return { kind: "ok", post, t, available, prev, next };
  } catch (err) {
    console.error(JSON.stringify({ msg: "post-d1-unavailable", error: String(err) }));
    return { kind: "unavailable" };
  }
}

export async function loadWriting(lang: Locale): Promise<{ items: ListedPost[]; ok: boolean }> {
  try {
    return { items: await listPublished(env.DB, lang), ok: true };
  } catch (err) {
    console.error(JSON.stringify({ msg: "writing-d1-unavailable", error: String(err) }));
    return { items: [], ok: false };
  }
}
