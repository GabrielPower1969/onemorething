import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { appOf, dailySalt, deviceOf, isBot, parseEvent, visitorHash } from "../../lib/analytics";
import { isProductionHost } from "../../lib/http";

export const prerender = false;

const noContent = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * Analytics beacon. Always answers 204 (never tells a scraper why it was ignored).
 * Writes happen in waitUntil so the visitor never waits on D1.
 */
export const POST: APIRoute = async ({ request, url, clientAddress, locals }) => {
  if (!isProductionHost(url) && !import.meta.env.DEV) return noContent();
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > 1024) return noContent();
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return noContent();
  if (request.headers.get("sec-gpc") === "1") return noContent();
  const ua = request.headers.get("user-agent") ?? "";
  if (isBot(ua)) return noContent();

  const ip = clientAddress || request.headers.get("cf-connecting-ip") || "0.0.0.0";
  try {
    const { success } = await env.BEACON_RL.limit({ key: ip });
    if (!success) return noContent();
  } catch {
    // Rate limiting is a noise filter only; carry on if the binding is unavailable (local dev).
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 1024) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }
  const event = parseEvent(body);
  if (!event) return noContent();

  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const write = async () => {
    try {
      const salt = await dailySalt(env.DB);
      const visitor = await visitorHash(salt, ip, ua);
      await env.DB.prepare(
        `INSERT INTO events (ts, type, path, lang, ref, campaign, target, section, value, country, device, app, visitor, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          Date.now(),
          event.type,
          event.path,
          event.lang,
          event.ref ?? null,
          event.campaign ?? null,
          event.target ?? null,
          event.section ?? null,
          event.value ?? null,
          cf?.country ?? null,
          deviceOf(ua),
          appOf(ua),
          visitor,
          env.CF_VERSION_METADATA?.id ?? null,
        )
        .run();
    } catch (err) {
      console.error(JSON.stringify({ msg: "beacon-write-failed", error: String(err) }));
    }
  };
  const ctx = locals.cfContext;
  if (ctx?.waitUntil) ctx.waitUntil(write());
  else await write();
  return noContent();
};

export const GET: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST" } });
