import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { readAdminJson } from "../../../lib/admin-api";
import { fail, json } from "../../../lib/http";
import { storeYouTubeThumb } from "../../../lib/media";
import type { Featured } from "../../../lib/page-data";
import { getSetting, setSetting } from "../../../lib/posts";
import { parseYouTubeId } from "../../../lib/youtube";

export const prerender = false;

type In = { featured?: Record<"en" | "zh", { youtube?: string; title?: string } | undefined> };

/** Featured video on Home, per language (empty URL = none). Poster is copied into R2. */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readAdminJson<In>(request);
  if (body instanceof Response) return body;
  const current = (await getSetting<Partial<Record<"en" | "zh", Featured>>>(env.DB, "featured_video")) ?? {};
  const next: Partial<Record<"en" | "zh", Featured | null>> = {};
  for (const lang of ["en", "zh"] as const) {
    const item = body.featured?.[lang];
    const raw = item?.youtube?.trim() ?? "";
    if (!raw) {
      next[lang] = null;
      continue;
    }
    const id = parseYouTubeId(raw);
    if (!id) return fail(422, "invalid-youtube", { lang });
    const title = (item?.title ?? "").trim().slice(0, 200);
    if (!title) return fail(422, "title-required", { lang });
    let cover = current[lang]?.youtube_id === id ? current[lang]!.cover_key : null;
    if (!cover) {
      const thumb = await storeYouTubeThumb(env.DB, env.MEDIA, id).catch(() => null);
      cover = thumb?.ok ? thumb.key : null;
    }
    next[lang] = { youtube_id: id, title, cover_key: cover };
  }
  await setSetting(env.DB, "featured_video", next);
  return json({ ok: true, featured: next });
};
