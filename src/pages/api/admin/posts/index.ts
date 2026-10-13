import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { readAdminJson, toPostInput } from "../../../../lib/admin-api";
import { fail, json } from "../../../../lib/http";
import { storeYouTubeThumb } from "../../../../lib/media";
import { listAll, savePost, validatePost } from "../../../../lib/posts";
import { parseYouTubeId } from "../../../../lib/youtube";

export const prerender = false;

export const GET: APIRoute = async () => json({ ok: true, posts: await listAll(env.DB) });

export const POST: APIRoute = async ({ request }) => {
  const body = await readAdminJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  return upsert(null, body);
};

/** Shared by create (POST) and update (PUT /[id]). */
export async function upsert(id: string | null, body: Record<string, unknown>): Promise<Response> {
  const input = toPostInput(body);
  const errors = validatePost(input);
  if (errors.length) return fail(422, "invalid", { errors });
  // A video post without a cover gets its YouTube thumbnail, copied into R2 (never hotlinked).
  const ytId = input.kind === "video" ? parseYouTubeId(input.youtube) : null;
  if (ytId && !input.cover_key) {
    const thumb = await storeYouTubeThumb(env.DB, env.MEDIA, ytId).catch(() => null);
    if (thumb?.ok) input.cover_key = thumb.key;
  }
  try {
    const postId = await savePost(env.DB, id, input);
    return json({ ok: true, id: postId, cover_key: input.cover_key ?? null });
  } catch (err) {
    if (String(err).includes("UNIQUE") && String(err).includes("slug")) return fail(409, "slug-taken");
    console.error(JSON.stringify({ msg: "post-save-failed", error: String(err) }));
    return fail(500, "save-failed");
  }
}
