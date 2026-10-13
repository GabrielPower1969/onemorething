/**
 * Extract the 11-character video id from any common YouTube URL form, or a bare id.
 * Returns null for anything else — callers store only the id, never the raw URL.
 */
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!HOSTS.has(url.hostname)) return null;
  let candidate: string | null = null;
  if (url.hostname === "youtu.be") {
    candidate = url.pathname.slice(1).split("/")[0];
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v");
  } else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    candidate = m ? m[1] : null;
  }
  return candidate && ID.test(candidate) ? candidate : null;
}

export const youTubeEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

export const youTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Server-side only: thumbnail source used once, when a cover is copied into R2. */
export const youTubeThumbUrls = (id: string) => [
  `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
];
