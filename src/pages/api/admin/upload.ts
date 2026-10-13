import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { fail, json, MAX_UPLOAD_BYTES, sameOrigin } from "../../../lib/http";
import { storeImage } from "../../../lib/media";

export const prerender = false;

/** Cover upload: raw image body (not multipart). Type is decided by magic bytes, not by the client. */
export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return fail(403, "cross-origin");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES) return fail(413, "too-large");
  const bytes = new Uint8Array(await request.arrayBuffer());
  const result = await storeImage(env.DB, env.MEDIA, bytes);
  return result.ok ? json(result) : fail(result.error === "too-large" ? 413 : 415, result.error);
};
