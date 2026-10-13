import { env } from "cloudflare:workers";
import type { Locale } from "../i18n/locales";
import { countPublished, listPublished, type ListedPost } from "./posts";

/**
 * Data for Home. D1 is optional here: if it is unavailable (quota, outage), Home still renders
 * everything that isn't a post — the Writing section simply disappears (docs/PLAN.md §5).
 */
export async function loadHome(lang: Locale): Promise<{ latest: ListedPost[]; publishedCount: number }> {
  try {
    const [latest, publishedCount] = await Promise.all([listPublished(env.DB, lang, 3), countPublished(env.DB)]);
    return { latest, publishedCount };
  } catch (err) {
    console.error(JSON.stringify({ msg: "home-d1-unavailable", error: String(err) }));
    return { latest: [], publishedCount: 0 };
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
