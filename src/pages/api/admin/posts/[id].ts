import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { readAdminJson } from "../../../../lib/admin-api";
import { fail, json, sameOrigin } from "../../../../lib/http";
import { getById } from "../../../../lib/posts";
import { upsert } from "./index";

export const prerender = false;

const ID = /^[0-9a-f-]{36}$/;

export const GET: APIRoute = async ({ params }) => {
  if (!ID.test(params.id ?? "")) return fail(404, "not-found");
  const post = await getById(env.DB, params.id!);
  return post ? json({ ok: true, post }) : fail(404, "not-found");
};

export const PUT: APIRoute = async ({ params, request }) => {
  if (!ID.test(params.id ?? "")) return fail(404, "not-found");
  if (!(await getById(env.DB, params.id!))) return fail(404, "not-found");
  const body = await readAdminJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  return upsert(params.id!, body);
};

/** Soft delete: the public URL answers 410 from now on. */
export const DELETE: APIRoute = async ({ params, request }) => {
  if (!sameOrigin(request)) return fail(403, "cross-origin");
  if (!ID.test(params.id ?? "")) return fail(404, "not-found");
  const res = await env.DB.prepare(`UPDATE posts SET status = 'archived', updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), params.id!)
    .run();
  return res.meta.changes ? json({ ok: true }) : fail(404, "not-found");
};
