import type { Locale } from "../i18n/locales";
import { renderMarkdown, SANITIZER_VERSION } from "./markdown";
import { parseYouTubeId } from "./youtube";
import { SLUG, slugify } from "./slug";

export { SLUG, slugify };

export const KINDS = ["text", "video", "audio"] as const;
export type Kind = (typeof KINDS)[number];
export type Status = "draft" | "published" | "archived";

export interface Translation {
  lang: Locale;
  title: string;
  summary: string;
  body_md: string;
  body_html: string;
  sanitizer_version: number;
  cover_alt: string;
}

export interface Post {
  id: string;
  slug: string;
  kind: Kind;
  status: Status;
  cover_key: string | null;
  youtube_id: string | null;
  media_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  i18n: Partial<Record<Locale, Translation>>;
}

/** A post as listed for one locale: its own translation, or the other one tagged as such. */
export interface ListedPost {
  post: Post;
  t: Translation;
  lang: Locale;
  isOtherLang: boolean;
}

type PostRow = Omit<Post, "i18n">;
type I18nRow = Translation & { post_id: string };

const POST_COLS = "id, slug, kind, status, cover_key, youtube_id, media_url, published_at, created_at, updated_at";

async function attachI18n(db: D1Database, rows: PostRow[]): Promise<Post[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT * FROM post_i18n WHERE post_id IN (${marks})`)
    .bind(...ids)
    .all<I18nRow>();
  const byPost = new Map<string, Post>(rows.map((r) => [r.id, { ...r, i18n: {} }]));
  for (const row of results) {
    const post = byPost.get(row.post_id);
    if (!post) continue;
    const { post_id: _, ...t } = row;
    if (t.sanitizer_version !== SANITIZER_VERSION) t.body_html = renderMarkdown(t.body_md);
    post.i18n[t.lang] = t;
  }
  return ids.map((id) => byPost.get(id)!);
}

export function pickTranslation(post: Post, lang: Locale): ListedPost | null {
  const own = post.i18n[lang];
  if (own && own.title) return { post, t: own, lang, isOtherLang: false };
  const otherLang: Locale = lang === "en" ? "zh" : "en";
  const other = post.i18n[otherLang];
  if (other && other.title) return { post, t: other, lang: otherLang, isOtherLang: true };
  return null;
}

export async function listPublished(db: D1Database, lang: Locale, limit = 200): Promise<ListedPost[]> {
  const { results } = await db
    .prepare(`SELECT ${POST_COLS} FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`)
    .bind(limit)
    .all<PostRow>();
  const posts = await attachI18n(db, results);
  return posts.map((p) => pickTranslation(p, lang)).filter((x): x is ListedPost => x !== null);
}

export async function countPublished(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE status = 'published'`).first<{ n: number }>();
  return row?.n ?? 0;
}

/** Published or archived (archived → caller answers 410). Drafts are never public. */
export async function getPublicBySlug(db: D1Database, slug: string): Promise<Post | null> {
  const row = await db
    .prepare(`SELECT ${POST_COLS} FROM posts WHERE slug = ? AND status IN ('published', 'archived')`)
    .bind(slug)
    .first<PostRow>();
  if (!row) return null;
  return (await attachI18n(db, [row]))[0];
}

export async function getAdjacent(db: D1Database, post: Post, lang: Locale) {
  const q = (op: string, order: string) =>
    db
      .prepare(
        `SELECT ${POST_COLS} FROM posts WHERE status = 'published' AND published_at ${op} ? ORDER BY published_at ${order} LIMIT 1`,
      )
      .bind(post.published_at)
      .first<PostRow>();
  const [older, newer] = await Promise.all([q("<", "DESC"), q(">", "ASC")]);
  const [prev, next] = await attachI18n(db, [older, newer].filter((r): r is PostRow => !!r)).then((list) => [
    older ? list.find((p) => p.id === older.id) : undefined,
    newer ? list.find((p) => p.id === newer.id) : undefined,
  ]);
  return {
    prev: prev ? pickTranslation(prev, lang) : null,
    next: next ? pickTranslation(next, lang) : null,
  };
}

// ---------------------------------------------------------------- admin

export async function listAll(db: D1Database): Promise<Post[]> {
  const { results } = await db
    .prepare(`SELECT ${POST_COLS} FROM posts ORDER BY COALESCE(published_at, updated_at) DESC`)
    .all<PostRow>();
  return attachI18n(db, results);
}

export async function getById(db: D1Database, id: string): Promise<Post | null> {
  const row = await db.prepare(`SELECT ${POST_COLS} FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  return row ? (await attachI18n(db, [row]))[0] : null;
}

export interface PostInput {
  slug: string;
  kind: Kind;
  status: Status;
  cover_key?: string | null;
  youtube?: string | null;
  media_url?: string | null;
  published_at?: string | null;
  i18n: Partial<Record<Locale, Partial<Pick<Translation, "title" | "summary" | "body_md" | "cover_alt">>>>;
}

export type ValidationError = { field: string; code: string };

/** Checks what the editor can't be trusted to check. Publishing needs a complete language. */
export function validatePost(input: PostInput): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!SLUG.test(input.slug ?? "")) errors.push({ field: "slug", code: "invalid" });
  if (!(KINDS as readonly string[]).includes(input.kind)) errors.push({ field: "kind", code: "invalid" });
  if (!["draft", "published", "archived"].includes(input.status)) errors.push({ field: "status", code: "invalid" });
  const strict = input.status === "published";
  if (input.kind === "video" && (strict || input.youtube?.trim()) && !parseYouTubeId(input.youtube))
    errors.push({ field: "youtube", code: "invalid" });
  if (input.kind === "audio" && (strict || input.media_url?.trim())) {
    try {
      const u = new URL(input.media_url ?? "");
      if (u.protocol !== "https:") errors.push({ field: "media_url", code: "https-only" });
    } catch {
      errors.push({ field: "media_url", code: "invalid" });
    }
  }
  if (input.status === "published") {
    const complete = (["en", "zh"] as Locale[]).filter((l) => {
      const t = input.i18n[l];
      return t?.title?.trim() && t?.summary?.trim() && (!input.cover_key || t?.cover_alt?.trim());
    });
    const started = (["en", "zh"] as Locale[]).filter((l) => input.i18n[l]?.title?.trim());
    if (!complete.length) errors.push({ field: "i18n", code: "no-complete-language" });
    for (const l of started) if (!complete.includes(l)) errors.push({ field: `i18n.${l}`, code: "incomplete" });
  }
  return errors;
}

export async function savePost(db: D1Database, id: string | null, input: PostInput): Promise<string> {
  const now = new Date().toISOString();
  const postId = id ?? crypto.randomUUID();
  const youtubeId = input.kind === "video" ? parseYouTubeId(input.youtube) : null;
  const publishedAt =
    input.status === "published" ? (input.published_at ? new Date(input.published_at).toISOString() : now) : input.published_at ?? null;
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO posts (id, slug, kind, status, cover_key, youtube_id, media_url, published_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
         ON CONFLICT(id) DO UPDATE SET slug = ?2, kind = ?3, status = ?4, cover_key = ?5, youtube_id = ?6,
           media_url = ?7, published_at = ?8, updated_at = ?9`,
      )
      .bind(
        postId,
        input.slug,
        input.kind,
        input.status,
        input.cover_key ?? null,
        youtubeId,
        input.kind === "audio" ? input.media_url ?? null : null,
        publishedAt,
        now,
      ),
  ];
  for (const lang of ["en", "zh"] as Locale[]) {
    const t = input.i18n[lang];
    if (!t || !(t.title?.trim() || t.body_md?.trim())) {
      stmts.push(db.prepare(`DELETE FROM post_i18n WHERE post_id = ? AND lang = ?`).bind(postId, lang));
      continue;
    }
    const md = t.body_md ?? "";
    stmts.push(
      db
        .prepare(
          `INSERT INTO post_i18n (post_id, lang, title, summary, body_md, body_html, sanitizer_version, cover_alt)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
           ON CONFLICT(post_id, lang) DO UPDATE SET title = ?3, summary = ?4, body_md = ?5, body_html = ?6,
             sanitizer_version = ?7, cover_alt = ?8`,
        )
        .bind(postId, lang, t.title ?? "", t.summary ?? "", md, renderMarkdown(md), SANITIZER_VERSION, t.cover_alt ?? ""),
    );
  }
  await db.batch(stmts);
  return postId;
}

// ---------------------------------------------------------------- settings

export type FeaturedVideo = { youtube_id: string; title: string } | null;

export async function getSetting<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setSetting(db: D1Database, key: string, value: unknown): Promise<void> {
  await db
    .prepare(`INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2`)
    .bind(key, JSON.stringify(value))
    .run();
}

export async function getFeaturedVideo(db: D1Database, lang: Locale): Promise<FeaturedVideo> {
  const all = await getSetting<Partial<Record<Locale, FeaturedVideo>>>(db, "featured_video");
  return all?.[lang] ?? all?.en ?? null;
}
