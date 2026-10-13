import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { readAdminJson } from "../../../lib/admin-api";
import { fail, json } from "../../../lib/http";
import { storeYouTubeThumb } from "../../../lib/media";
import { parseYouTubeId } from "../../../lib/youtube";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await readAdminJson<{ youtube?: string }>(request);
  if (body instanceof Response) return body;
  const id = parseYouTubeId(body.youtube);
  if (!id) return fail(422, "invalid-youtube");
  const result = await storeYouTubeThumb(env.DB, env.MEDIA, id);
  return result.ok ? json({ ...result, youtube_id: id }) : fail(502, result.error);
};
