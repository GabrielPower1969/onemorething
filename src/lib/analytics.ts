import { isbot } from "isbot";
import { WORK, HEADER_LINKS, SOCIAL } from "../config/site";

/**
 * First-party analytics (docs/PLAN.md §7, metric definitions in docs/METRICS.md).
 * Everything that reaches D1 passes `parseEvent` — unknown types/targets/sections are dropped,
 * so the events table can't be used to inject arbitrary strings into the dashboard.
 */
export const EVENT_TYPES = ["pageview", "section", "engage", "out", "email", "lang", "play", "read"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SECTIONS = ["overture", "hello", "work", "writing", "stage", "contact", "header", "menu", "footer", "post"] as const;

export const OUT_TARGETS = new Set<string>([
  ...WORK.map((w) => w.id),
  ...HEADER_LINKS.map((l) => l.id),
  ...SOCIAL.map((s) => s.id),
  "youtube-watch",
  "audio",
  "source",
  "other",
]);

/** Group-level campaign codes for ?r= links. One code per audience, never per person. */
export const CAMPAIGNS = new Set(["li", "wx", "x", "red", "gh", "mail", "talk", "cv"]);

export interface BeaconEvent {
  type: EventType;
  path: string;
  lang: "en" | "zh";
  ref?: string;
  campaign?: string;
  target?: string;
  section?: string;
  value?: number;
}

const MAX_PATH = 200;

export function parseEvent(input: unknown): BeaconEvent | null {
  if (!input || typeof input !== "object") return null;
  const e = input as Record<string, unknown>;
  const type = e.type;
  if (typeof type !== "string" || !(EVENT_TYPES as readonly string[]).includes(type)) return null;
  const path = typeof e.path === "string" ? e.path : "";
  if (!path.startsWith("/") || path.length > MAX_PATH || /[\s<>"']/.test(path)) return null;
  const lang = e.lang === "zh" ? "zh" : "en";
  const out: BeaconEvent = { type: type as EventType, path, lang };
  if (typeof e.ref === "string" && /^[a-z0-9.-]{1,100}$/i.test(e.ref)) out.ref = e.ref.toLowerCase();
  if (typeof e.campaign === "string" && CAMPAIGNS.has(e.campaign)) out.campaign = e.campaign;
  if (typeof e.section === "string" && (SECTIONS as readonly string[]).includes(e.section)) out.section = e.section;
  if (typeof e.target === "string") {
    if (type === "out" && OUT_TARGETS.has(e.target)) out.target = e.target;
    else if (type === "lang" && (e.target === "en" || e.target === "zh")) out.target = e.target;
    else if (type === "email" && (e.target === "mailto" || e.target === "copy")) out.target = e.target;
    else if ((type === "play" || type === "read") && /^[a-z0-9-]{1,80}$/.test(e.target)) out.target = e.target;
  }
  if (typeof e.value === "number" && Number.isFinite(e.value)) out.value = Math.max(0, Math.min(86_400, Math.round(e.value)));
  if (type === "out" && !out.target) return null;
  return out;
}

export function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/** In-app browsers that send no referrer — without this, WeChat visits look "direct". */
export function appOf(ua: string): string | null {
  if (/MicroMessenger/i.test(ua)) return "wechat";
  if (/LinkedInApp/i.test(ua)) return "linkedin";
  if (/\bFBAN|\bFBAV|Instagram/i.test(ua)) return "meta";
  if (/XiaoHongShu|discover\/\d/i.test(ua)) return "red";
  if (/Twitter/i.test(ua)) return "x";
  return null;
}

export function isBot(ua: string | null): boolean {
  return !ua || isbot(ua) || /HeadlessChrome|Lighthouse|PageSpeed|Prerender/i.test(ua);
}

/** New Zealand calendar day, e.g. "2026-10-13" — salts and "visitor-days" follow it. */
export function nzDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now);
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function visitorHash(salt: string, ip: string, ua: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}|${ua}`);
  return hex(await crypto.subtle.digest("SHA-256", data)).slice(0, 16);
}

/**
 * Today's salt: 32 random bytes, created on first use each NZ day. Older salts are deleted
 * (> 48 h), so yesterday's hashes can never be recomputed. Raw events past retention go too.
 */
export async function dailySalt(db: D1Database, now = new Date()): Promise<string> {
  const day = nzDay(now);
  const existing = await db.prepare(`SELECT salt FROM daily_salt WHERE day = ?`).bind(day).first<{ salt: string }>();
  if (existing) return existing.salt;
  const salt = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const twoDaysAgo = nzDay(new Date(now.getTime() - 2 * 86_400_000));
  const retentionMs = now.getTime() - RETENTION_DAYS * 86_400_000;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO daily_salt (day, salt) VALUES (?, ?)`).bind(day, salt),
    db.prepare(`DELETE FROM daily_salt WHERE day < ?`).bind(twoDaysAgo),
    // Retention trim, at most 5k rows per day so the quota can't spike.
    db.prepare(`DELETE FROM events WHERE id IN (SELECT id FROM events WHERE ts < ? LIMIT 5000)`).bind(retentionMs),
  ]);
  const row = await db.prepare(`SELECT salt FROM daily_salt WHERE day = ?`).bind(day).first<{ salt: string }>();
  return row?.salt ?? salt;
}

export const RETENTION_DAYS = 395; // ~13 months
