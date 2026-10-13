import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const KEY = /^[a-z0-9-]{8,64}\.(jpg|png|webp|avif)$/;

/** Cover images from R2. Keys are random and never reused, so responses cache forever. */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key ?? "";
  if (!KEY.test(key)) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("content-disposition", "inline");
  if (!("body" in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
};
