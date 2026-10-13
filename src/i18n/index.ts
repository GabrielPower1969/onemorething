import { en, type Messages } from "./en";
import { zh } from "./zh";
import { LOCALES, TIME_ZONE, isLocale, type Locale } from "./locales";

export * from "./locales";
export type { Messages };

const CATALOG: Record<Locale, Messages> = { en, zh };

/** Dot-separated paths to every string leaf, e.g. "home.story1". */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

export type Params = Record<string, string | number>;

function lookup(messages: Messages, key: MessageKey): string {
  let node: unknown = messages;
  for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
  if (typeof node !== "string") throw new Error(`i18n: missing key "${key}"`);
  return node;
}

export function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Returns a translator bound to one locale: `const t = useT(Astro.currentLocale)`. */
export function useT(locale: string | undefined) {
  const lang: Locale = isLocale(locale) ? locale : "en";
  const messages = CATALOG[lang];
  const t = (key: MessageKey, params?: Params) => format(lookup(messages, key), params);
  return Object.assign(t, { lang, messages });
}

export function messagesFor(locale: Locale): Messages {
  return CATALOG[locale];
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Render the only inline markup allowed in locale strings: *emphasis*. Output is escaped first. */
export function rich(s: string): string {
  return escapeHtml(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/** Strip *emphasis* markers for plain-text contexts (titles, meta, typing). */
export const plain = (s: string) => s.replace(/\*([^*]+)\*/g, "$1");

export function formatDate(iso: string | Date, locale: Locale, style: "short" | "long" = "short"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(LOCALES[locale].intl, {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: style === "short" ? "short" : "long",
    day: "numeric",
  }).format(d);
}
