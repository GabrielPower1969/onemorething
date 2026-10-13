import { Marked } from "marked";
import { FilterXSS, escapeAttrValue } from "xss";

/**
 * Markdown → safe HTML. Used at save time (result stored with SANITIZER_VERSION) and by the
 * admin live preview, so what Gabriel previews is exactly what visitors get.
 * Bump SANITIZER_VERSION whenever the allowlist changes; stale rows are re-rendered on read.
 */
export const SANITIZER_VERSION = 1;

const marked = new Marked({ gfm: true, breaks: false, async: false });
// Raw HTML in markdown is dropped entirely (rendered as nothing), not sanitized-and-kept.
marked.use({ renderer: { html: () => "" } });

const SAFE_URL = /^(https?:|mailto:|\/(?!\/)|#)/i;

const filter = new FilterXSS({
  whiteList: {
    a: ["href", "title", "rel", "target"],
    p: [], br: [], hr: [],
    h2: ["id"], h3: ["id"], h4: ["id"],
    strong: [], em: [], del: [], code: [], pre: [], blockquote: [],
    ul: [], ol: ["start"], li: [],
    img: ["src", "alt", "title", "width", "height", "loading"],
    table: [], thead: [], tbody: [], tr: [], th: ["align"], td: ["align"],
    figure: [], figcaption: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed", "noscript", "template"],
  onTagAttr(tag, name, value) {
    if ((tag === "a" && name === "href") || (tag === "img" && name === "src")) {
      const v = value.trim();
      if (!SAFE_URL.test(v)) return "";
      if (tag === "img" && !/^(https:|\/(?!\/))/i.test(v)) return "";
      return `${name}="${escapeAttrValue(v)}"`;
    }
    if (tag === "a" && (name === "rel" || name === "target")) return ""; // set below
    return undefined;
  },
});

function hardenLinks(html: string): string {
  return html
    .replace(/<a (?=[^>]*href="(?:https?:)?\/\/)/g, '<a rel="noopener nofollow" target="_blank" ')
    .replace(/<img /g, '<img loading="lazy" ');
}

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? "") as string;
  return hardenLinks(filter.process(raw));
}

/** Rough reading time for the post meta line. CJK counts characters, Latin counts words. */
export function readingMinutes(md: string): number {
  const cjk = (md.match(/\p{Script=Han}/gu) || []).length;
  const words = md.replace(/\p{Script=Han}/gu, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230 + cjk / 400));
}
