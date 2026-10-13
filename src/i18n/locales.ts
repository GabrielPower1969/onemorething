/** Single source of truth for every language code used anywhere on the site. */
export const LOCALES = {
  en: {
    path: "", // default locale lives at the root
    html: "en",
    hreflang: "en",
    og: "en_US",
    rss: "en",
    intl: "en-NZ",
  },
  zh: {
    path: "zh",
    html: "zh-Hans",
    hreflang: "zh-Hans",
    og: "zh_CN",
    rss: "zh-cn",
    intl: "zh-Hans-CN",
  },
} as const;

export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = "en";
export const ALL_LOCALES = Object.keys(LOCALES) as Locale[];
/** All dates on the site are shown in New Zealand time. */
export const TIME_ZONE = "Pacific/Auckland";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in LOCALES;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "zh" : "en";
}

/** Prefix a site path ("/writing") with the locale segment ("/zh/writing"). */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const prefix = LOCALES[locale].path;
  if (!prefix) return clean;
  return clean === "/" ? `/${prefix}/` : `/${prefix}${clean}`;
}

/** Strip a leading locale segment: "/zh/writing/x" → { locale: "zh", path: "/writing/x" }. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = pathname.match(/^\/(zh)(\/.*)?$/);
  if (m) return { locale: "zh", path: m[2] || "/" };
  return { locale: "en", path: pathname || "/" };
}
