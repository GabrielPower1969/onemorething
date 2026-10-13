/**
 * First-party analytics beacon (docs/PLAN.md §7, docs/METRICS.md).
 * No cookies, no identifiers stored in the browser. Off when the visitor opted out on
 * /privacy, sends Global Privacy Control, or is an automated browser.
 */
const OPT_OUT_KEY = "omt_optout";

type Payload = {
  type: string;
  target?: string;
  section?: string;
  value?: number;
};

const lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";

export function trackingAllowed(): boolean {
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === "1") return false;
  } catch {}
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl || nav.webdriver) return false;
  return true;
}

let ref: string | undefined;
let campaign: string | undefined;

function send(p: Payload) {
  if (!trackingAllowed()) return;
  const body = JSON.stringify({ ...p, path: location.pathname, lang, ref, campaign });
  if (body.length > 1000) return;
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/t", blob)) {
    fetch("/api/t", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

function captureSource() {
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== location.hostname) ref = host;
    }
  } catch {}
  const url = new URL(location.href);
  const r = url.searchParams.get("r");
  if (r) {
    campaign = r.toLowerCase().slice(0, 12);
    url.searchParams.delete("r");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
}

function sectionOf(el: Element | null): string | undefined {
  return el?.closest<HTMLElement>("[data-section]")?.dataset.section;
}

function watchSections() {
  const seen = new Set<string>();
  const timers = new Map<Element, number>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const name = (e.target as HTMLElement).dataset.section!;
        if (seen.has(name)) continue;
        if (e.isIntersecting) {
          timers.set(
            e.target,
            window.setTimeout(() => {
              seen.add(name);
              send({ type: "section", section: name });
            }, 1500),
          );
        } else {
          clearTimeout(timers.get(e.target));
        }
      }
    },
    { threshold: [0.5] },
  );
  document.querySelectorAll("main [data-section]").forEach((el) => io.observe(el));
}

function watchEngagement() {
  let visibleSince = document.visibilityState === "visible" ? performance.now() : 0;
  let total = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (visibleSince) total += performance.now() - visibleSince;
      visibleSince = 0;
      if (total >= 1000) send({ type: "engage", value: Math.round(total / 1000) });
      total = 0;
    } else {
      visibleSince = performance.now();
    }
  });
}

function watchReading() {
  const article = document.querySelector<HTMLElement>("[data-read]");
  if (!article) return;
  const slug = article.dataset.read!;
  const sentinel = document.createElement("div");
  sentinel.style.cssText = "height:1px;width:1px;";
  const children = article.children;
  const at = Math.max(0, Math.floor(children.length * 0.9) - 1);
  const ref = children[at] ?? article;
  ref.parentNode?.insertBefore(sentinel, ref.nextSibling);
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      io.disconnect();
      send({ type: "read", target: slug, value: 90 });
    }
  });
  io.observe(sentinel);
}

function watchClicks() {
  document.addEventListener(
    "click",
    (ev) => {
      const el = (ev.target as Element | null)?.closest<HTMLElement>("[data-track-out],[data-track-email],[data-track-lang],[data-track-play]");
      if (!el) return;
      const section = sectionOf(el);
      if (el.dataset.trackOut) send({ type: "out", target: el.dataset.trackOut, section });
      else if (el.dataset.trackEmail) send({ type: "email", target: el.dataset.trackEmail, section });
      else if (el.dataset.trackLang) send({ type: "lang", target: el.dataset.trackLang, section });
      else if (el.dataset.trackPlay) send({ type: "play", target: el.dataset.trackPlay, section });
    },
    { capture: true },
  );
}

export function initTracking() {
  captureSource();
  const start = () => {
    send({ type: "pageview" });
    watchSections();
    watchEngagement();
    watchReading();
  };
  const doc = document as Document & { prerendering?: boolean };
  if (doc.prerendering) document.addEventListener("prerenderingchange", start, { once: true });
  else start();
  watchClicks();
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) send({ type: "pageview" });
  });
}

export function setOptOut(out: boolean) {
  try {
    if (out) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {}
}
