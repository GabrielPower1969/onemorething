import { env } from "cloudflare:workers";
import type { Locale } from "../i18n/locales";
import { countPublished, getSetting, listPublished, type ListedPost } from "./posts";

export type Featured = { youtube_id: string; title: string; cover_key: string | null };

/**
 * Data for Home. D1 is optional here: if it is unavailable (quota, outage), Home still renders
 * everything that isn't a post — the Writing section simply disappears (docs/PLAN.md §5).
 */
export async function loadHome(
  lang: Locale,
): Promise<{ latest: ListedPost[]; featured: Featured | null; featuredLang: Locale; publishedCount: number }> {
  try {
    const [latest, publishedCount, featuredAll] = await Promise.all([
      listPublished(env.DB, lang, 3),
      countPublished(env.DB),
      getSetting<Partial<Record<Locale, Featured>>>(env.DB, "featured_video"),
    ]);
    // The Chinese home falls back to the English featured video; its caption is then marked lang="en".
    const own = featuredAll?.[lang];
    const featured = own?.youtube_id ? own : featuredAll?.en?.youtube_id ? featuredAll.en : null;
    const featuredLang: Locale = own?.youtube_id ? lang : "en";
    return { latest, featured, featuredLang, publishedCount };
  } catch (err) {
    console.error(JSON.stringify({ msg: "home-d1-unavailable", error: String(err) }));
    return { latest: [], featured: null, featuredLang: lang, publishedCount: 0 };
  }
}

/** Header needs to know whether to show "Writing" on every page. Same graceful fallback. */
export async function publishedCountSafe(): Promise<number> {
  try {
    return await countPublished(env.DB);
  } catch {
    return 0;
  }
}
