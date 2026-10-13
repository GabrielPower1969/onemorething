import { fail, sameOrigin } from "./http";
import { KINDS, SLUG, type Kind, type PostInput, type Status } from "./posts";
import type { Locale } from "../i18n/locales";

/** JSON body for admin writes: same-origin only, ≤ 512 KB. Returns a Response on rejection. */
export async function readAdminJson<T>(request: Request): Promise<T | Response> {
  if (!sameOrigin(request)) return fail(403, "cross-origin");
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return fail(415, "json-only");
  const text = await request.text();
  if (text.length > 512 * 1024) return fail(413, "too-large");
  try {
    return JSON.parse(text) as T;
  } catch {
    return fail(400, "bad-json");
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Coerce untrusted editor JSON into a PostInput (validation happens in validatePost). */
export function toPostInput(body: Record<string, unknown>): PostInput {
  const i18nIn = (body.i18n ?? {}) as Record<string, Record<string, unknown>>;
  const i18n: PostInput["i18n"] = {};
  for (const lang of ["en", "zh"] as Locale[]) {
    const t = i18nIn[lang];
    if (!t) continue;
    i18n[lang] = {
      title: str(t.title, 300).trim(),
      summary: str(t.summary, 600).trim(),
      body_md: str(t.body_md, 200_000),
      cover_alt: str(t.cover_alt, 300).trim(),
    };
  }
  const kind = (KINDS as readonly string[]).includes(body.kind as string) ? (body.kind as Kind) : ("text" as Kind);
  const status = ["draft", "published", "archived"].includes(body.status as string) ? (body.status as Status) : "draft";
  const cover = str(body.cover_key, 80);
  return {
    slug: str(body.slug, 80).trim(),
    kind,
    status,
    cover_key: /^[a-z0-9-]{8,64}\.(jpg|png|webp|avif)$/.test(cover) ? cover : null,
    youtube: str(body.youtube, 300).trim() || null,
    media_url: str(body.media_url, 1000).trim() || null,
    published_at: str(body.published_at, 40) || null,
    i18n,
  };
}

export const isSlug = (s: string) => SLUG.test(s);
