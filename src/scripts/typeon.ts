/**
 * Typing engine for [data-typeon] lines (markup: src/components/TypeLine.astro).
 *
 * Every text node inside a line is split into a visible part and a transparent remainder
 * (`.t-v` + `.t-h`), so the line's full text stays in the DOM and its layout never moves.
 * Runs only when <html> has .js-typing (first view per session, no reduced motion).
 */
const SESSION_KEY = "omt_typed";
const PAUSE_AFTER = /[.,;:!?—，。、：；！？]$/u;
const CJK = /\p{Script=Han}/u;

type Unit = { v: HTMLSpanElement; h: HTMLSpanElement; parts: string[] };

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const graphemes = (s: string) => (segmenter ? [...segmenter.segment(s)].map((x) => x.segment) : [...s]);

function prepare(line: HTMLElement): Unit[] {
  const body = line.querySelector<HTMLElement>(".t-body");
  if (!body) return [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes.map((node) => {
    const v = document.createElement("span");
    const h = document.createElement("span");
    v.className = "t-v";
    h.className = "t-h";
    h.textContent = node.data;
    // insertBefore/replaceChild rather than replaceWith/after: Workers' HTMLRewriter types shadow those.
    const parent = node.parentNode!;
    parent.insertBefore(v, node);
    parent.replaceChild(h, node);
    return { v, h, parts: graphemes(node.data) };
  });
}

const insertAfter = (ref: Node, node: Node) => ref.parentNode?.insertBefore(node, ref.nextSibling);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function delayFor(ch: string): number {
  if (PAUSE_AFTER.test(ch)) return 280;
  if (CJK.test(ch)) return 70;
  return 38 + Math.round((Math.random() - 0.5) * 24);
}

class Typist {
  private skipped = false;
  skip() {
    this.skipped = true;
  }

  async type(line: HTMLElement) {
    const units = prepare(line);
    const caret = line.querySelector<HTMLElement>(".caret");
    line.classList.add("is-typing");
    for (const u of units) {
      if (caret) insertAfter(u.v, caret);
      let shown = "";
      for (let i = 0; i < u.parts.length; i++) {
        if (this.skipped) break;
        shown += u.parts[i];
        u.v.textContent = shown;
        u.h.textContent = u.parts.slice(i + 1).join("");
        if (caret) insertAfter(u.v, caret);
        await sleep(delayFor(u.parts[i]));
      }
      u.v.textContent = u.parts.join("");
      u.h.textContent = "";
    }
    const body = line.querySelector(".t-body");
    if (caret && body) insertAfter(body, caret);
    line.classList.remove("is-typing");
    line.classList.add("is-typed", "is-caret");
  }
}

function finish(line: HTMLElement) {
  line.classList.remove("is-typing");
  line.classList.add("is-typed");
}

function fadeCaret(line: HTMLElement, after = 2000) {
  setTimeout(() => {
    line.classList.remove("is-caret");
    line.classList.add("is-caret-out");
  }, after);
}

export function initTypeOn() {
  const root = document.documentElement;
  const overture = [...document.querySelectorAll<HTMLElement>('[data-typeon="overture"]')];
  const stage = [...document.querySelectorAll<HTMLElement>('[data-typeon="stage"]')];
  const dot = document.querySelector<HTMLElement>(".breath");

  if (!root.classList.contains("js-typing")) {
    [...overture, ...stage].forEach(finish);
    dot?.classList.add("is-on");
    return;
  }
  root.classList.add("typeon-armed");

  // Overture: type immediately; any scroll / key / click completes it.
  const intro = new Typist();
  const skip = () => intro.skip();
  for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"] as const)
    window.addEventListener(ev, skip, { once: true, passive: true });
  (async () => {
    await sleep(500);
    for (const line of overture) await intro.type(line);
    dot?.classList.add("is-on");
    overture.forEach((l) => fadeCaret(l, 1200));
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  })();

  // Stage: lines type in order once the black stage is a third on screen.
  const stageEl = document.querySelector("[data-stage]");
  if (stageEl && stage.length) {
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const typist = new Typist();
        for (const line of stage) {
          await typist.type(line);
          line.classList.remove("is-caret");
          await sleep(350);
        }
        const last = stage[stage.length - 1];
        last.classList.add("is-caret");
        fadeCaret(last);
      },
      { threshold: 0.35 },
    );
    io.observe(stageEl);
  }
}

/** The breathing dot only breathes while the Overture is on screen (WCAG 2.2.2, battery). */
export function initBreath() {
  const dot = document.querySelector<HTMLElement>(".breath");
  const overture = document.querySelector(".overture");
  if (!dot || !overture) return;
  new IntersectionObserver(([e]) => {
    dot.classList.toggle("is-breathing", e.isIntersecting && dot.classList.contains("is-on"));
    document.documentElement.classList.toggle("past-overture", !e.isIntersecting);
  }).observe(overture);
  // Start breathing as soon as the dot appears. Guarded: classList.add always rewrites the
  // attribute, which would re-trigger this observer forever.
  new MutationObserver(() => {
    const shouldBreathe = dot.classList.contains("is-on") && !document.documentElement.classList.contains("past-overture");
    if (shouldBreathe && !dot.classList.contains("is-breathing")) dot.classList.add("is-breathing");
  }).observe(dot, { attributes: true, attributeFilter: ["class"] });
}
