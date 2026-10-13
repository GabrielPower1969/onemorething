import { SITE } from "../config/site";
import { ALL_LOCALES, LOCALES, localePath, otherLocale, type Locale } from "./locales";

/**
 * One place decides hreflang, canonical and where the language toggle goes, so the
 * <head>, the sitemap and the header can never disagree (docs/PLAN.md §4.2).
 *
 * `path` is locale-less ("/", "/writing", "/writing/slug").
 * `available` lists the locales this page really exists in.
 */
export interface PageLanguages {
  locale: Locale;
  path: string;
  available: readonly Locale[];
}

export const absolute = (path: string) => new URL(path, SITE.origin).href;

export function canonicalUrl(p: PageLanguages): string {
  return absolute(localePath(p.locale, p.path));
}

/** hreflang links only when a real counterpart exists; they always include the page itself. */
export function hreflangLinks(p: PageLanguages): { hreflang: string; href: string }[] {
  const langs = ALL_LOCALES.filter((l) => p.available.includes(l));
  if (langs.length < 2) return [];
  const links: { hreflang: string; href: string }[] = langs.map((l) => ({
    hreflang: LOCALES[l].hreflang,
    href: absolute(localePath(l, p.path)),
  }));
  const xDefault = langs.includes("en") ? "en" : langs[0];
  links.push({ hreflang: "x-default", href: absolute(localePath(xDefault, p.path)) });
  return links;
}

/** The toggle goes to the counterpart page, or to the other language's Writing index. */
export function toggleHref(p: PageLanguages): string {
  const target = otherLocale(p.locale);
  if (p.available.includes(target)) return localePath(target, p.path);
  return localePath(target, p.path.startsWith("/writing") ? "/writing" : "/");
}

export const BOTH: readonly Locale[] = ["en", "zh"];
