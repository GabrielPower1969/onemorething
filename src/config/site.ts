/**
 * Non-translatable site configuration: URLs, ids, years and feature flags.
 * Every external URL on the site lives here exactly once. Words live in src/i18n.
 * Every `work[].id` must have `work.<id>.{name,role,line}` in both locale files
 * (checked by scripts/i18n-check.mjs).
 */
export const SITE = {
  origin: "https://onemorething.today",
  productionHost: "onemorething.today",
  email: "gabriel@onemorething.today",
  author: {
    alternateName: "Guangyu Chen",
  },
} as const;

export type SocialId = "github" | "linkedin" | "youtube";

/** Profiles of Gabriel himself (also used for JSON-LD sameAs). Empty url = hidden. */
export const SOCIAL: { id: SocialId; url: string; header: boolean }[] = [
  { id: "github", url: "https://github.com/GabrielPower1969", header: true },
  { id: "linkedin", url: "https://www.linkedin.com/in/gabriel-chen-digimon-programer", header: true },
  { id: "youtube", url: "", header: false },
];

/** Text links in the header, in order. */
export const HEADER_LINKS = [
  { id: "flowgt", label: "flowgt", url: "https://flowgt.co.nz" },
  { id: "loyal", label: "loyalasabook", url: "https://loyalasabook.com" },
] as const;

export type WorkId = "flowgt" | "loyal" | "trimble" | "citanz" | "muse";

/** Portfolio rows on Home, in display order. */
export const WORK: { id: WorkId; url: string; since: string; until?: string }[] = [
  { id: "flowgt", url: "https://flowgt.co.nz", since: "2025" },
  { id: "loyal", url: "https://loyalasabook.com", since: "2026" },
  { id: "trimble", url: "https://www.trimble.com", since: "2025" },
  { id: "citanz", url: "https://www.cita.org.nz", since: "2024" },
  { id: "muse", url: "https://themuse.org.nz", since: "" },
];

export const FEATURES = {
  /** Show "Writing" in the header once at least this many posts are published (0 = always). */
  writingInHeaderMinPosts: 1,
  /** First-party analytics beacon. */
  analytics: true,
} as const;

export function yearsLabel(since: string, until?: string): string {
  if (!since) return "";
  return until ? `${since}–${until}` : `${since}–`;
}
