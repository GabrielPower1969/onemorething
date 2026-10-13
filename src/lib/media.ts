import { ALLOWED_IMAGE_TYPES, imageSize, MAX_UPLOAD_BYTES, sniffImage, type ImageType } from "./http";
import { youTubeThumbUrls } from "./youtube";

const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export type StoreResult = { ok: true; key: string; width: number | null; height: number | null } | { ok: false; error: string };

/** Validate by magic bytes and store under a random, never-reused key. */
export async function storeImage(db: D1Database, bucket: R2Bucket, bytes: Uint8Array): Promise<StoreResult> {
  if (bytes.byteLength === 0) return { ok: false, error: "empty" };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "too-large" };
  const type = sniffImage(bytes);
  if (!type || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) return { ok: false, error: "unsupported-type" };
  const key = `${crypto.randomUUID()}.${EXT[type]}`;
  const size = imageSize(bytes, type);
  await bucket.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
  await db
    .prepare(`INSERT INTO media (key, content_type, bytes, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(key, type, bytes.byteLength, size?.width ?? null, size?.height ?? null, new Date().toISOString())
    .run();
  return { ok: true, key, width: size?.width ?? null, height: size?.height ?? null };
}

/** Copy a YouTube thumbnail into R2 once, so visitors never load images from Google. */
export async function storeYouTubeThumb(db: D1Database, bucket: R2Bucket, id: string): Promise<StoreResult> {
  for (const url of youTubeThumbUrls(id)) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // maxresdefault returns a tiny grey placeholder (120x90) when missing.
    if (bytes.byteLength < 5000) continue;
    return storeImage(db, bucket, bytes);
  }
  return { ok: false, error: "thumbnail-unavailable" };
}
