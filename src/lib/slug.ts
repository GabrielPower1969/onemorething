/** URL slugs for posts: lowercase ASCII words joined by single dashes. Shared by server and admin UI. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
