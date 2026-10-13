import { SITE } from "../config/site";

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", ...headers },
  });

export const fail = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  json({ ok: false, error: code, ...extra }, status);

/** Same-origin check for state-changing admin requests (in addition to Astro's checkOrigin). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export const isProductionHost = (url: URL) =>
  url.hostname === SITE.productionHost || url.hostname === `www.${SITE.productionHost}`;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Content type from magic bytes only — the client's claim is ignored. SVG is never accepted. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  const b = bytes;
  const at = (i: number, ...sig: number[]) => sig.every((v, k) => b[i + k] === v);
  if (b.length < 12) return null;
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(4, 0x66, 0x74, 0x79, 0x70) && (at(8, 0x61, 0x76, 0x69, 0x66) || at(8, 0x61, 0x76, 0x69, 0x73))) return "image/avif";
  return null;
}

/** Best-effort pixel size for JPEG/PNG/WebP so covers reserve their box (no layout shift). */
export function imageSize(bytes: Uint8Array, type: ImageType): { width: number; height: number } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (type === "image/png") return { width: dv.getUint32(16), height: dv.getUint32(20) };
    if (type === "image/webp") {
      const chunk = String.fromCharCode(...bytes.slice(12, 16));
      if (chunk === "VP8X") return { width: 1 + (dv.getUint32(24, true) & 0xffffff), height: 1 + (dv.getUint32(27, true) & 0xffffff) };
      if (chunk === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const v = dv.getUint32(21, true);
        return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
      }
    }
    if (type === "image/jpeg") {
      let i = 2;
      while (i < bytes.length) {
        if (bytes[i] !== 0xff) return null;
        const marker = bytes[i + 1];
        const len = dv.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
          return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
        i += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}
