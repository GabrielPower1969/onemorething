import type { APIRoute } from "astro";
import { readAdminJson } from "../../../lib/admin-api";
import { json } from "../../../lib/http";
import { renderMarkdown } from "../../../lib/markdown";

export const prerender = false;

/** Live preview uses the exact sanitizer the public pages use. */
export const POST: APIRoute = async ({ request }) => {
  const body = await readAdminJson<{ md?: string }>(request);
  if (body instanceof Response) return body;
  return json({ ok: true, html: renderMarkdown(String(body.md ?? "").slice(0, 200_000)) });
};
