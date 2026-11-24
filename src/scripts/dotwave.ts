/**
 * The Overture's encore (Gabriel 2026-11-25). Once "One more thing" has typed itself in and the
 * full stop has appeared, the full stop:
 *   1. hops onto the dot of the i and sits exactly on it;
 *   2. hops over the o of "more", hovers, grows (non-linearly) into an o the size of that o,
 *      and drops into it;
 *   3. that o hops over the O of "One", swells into a slightly-too-big O, drops into it and is gone;
 *   4. the O jumps, and a wave runs letter by letter to the end of the line, where the full stop
 *      stands up again as the last one. The line is back where it started.
 *
 * Every length is in em of the line, so it is the same at any width. Glyph geometry (the i's dot,
 * the middle of o and O, the o's stroke) is measured by drawing the letters on a canvas.
 * Only transform / opacity / size are written, through CSSOM (CSP-safe, no style attributes).
 * Plays with the typing (first view per session, no reduced motion); any scroll, key or click
 * ends it on the final frame. Clicking the full stop plays it again.
 */

const BEATS = {
  restAfterDot: 1.4,
  crouch: 0.12,
  holdOnI: 0.3,
  hoverH: 0.82,
  growO: 0.55,
  hoverAfterGrow: 0.18,
  drop: 0.26,
  holdOnO: 0.25,
  growBig: 0.42,
  holdBig: 0.5,
  waveStep: 0.075,
  waveRise: 0.5,
  waveHeight: 0.2,
  OJump: 0.38,
};

type Pt = { x: number; y: number };
type Squashy = { sx: number; sy: number; rot?: number };
type Letter = { ch: string; left: number; top: number; x: number; mid: number; w: number; h: number; stem: number; tittle?: Pt & { w: number } };
type Ghost = { el: HTMLSpanElement; i: number; dx: number; dy: number; s: number; sx: number; sy: number; op: number };

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const ease = {
  io: (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  out: (p: number) => 1 - (1 - p) ** 3,
  in: (p: number) => p * p,
  back: (p: number) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2,
  elastic: (p: number) => (p === 0 || p === 1 ? p : 1 - Math.cos(p * Math.PI * 2.5) * Math.exp(-p * 5.5)),
};

/** Ink of one character, drawn on a canvas: vertical blobs (the i has two), centre, stroke. */
function ink(ch: string, font: string, fs: number) {
  const W = Math.ceil(fs * 2);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = W; // size first: resizing resets the context's font
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.font = font;
  x.textBaseline = "alphabetic";
  const ox = fs * 0.4, by = fs * 1.4;
  x.fillText(ch, ox, by);
  const d = x.getImageData(0, 0, W, W).data;
  const on = (i: number, y: number) => d[(y * W + i) * 4 + 3] > 100;
  const blobs: { top: number; bot: number; l: number; r: number }[] = [];
  let cur: (typeof blobs)[number] | null = null;
  for (let y = 0; y < W; y++) {
    let a = W, b = -1;
    for (let i = 0; i < W; i++) if (on(i, y)) { if (i < a) a = i; b = i; }
    if (b < 0) { cur = null; continue; }
    if (!cur) blobs.push((cur = { top: y, bot: y, l: a, r: b }));
    else { cur.bot = y; cur.l = Math.min(cur.l, a); cur.r = Math.max(cur.r, b); }
  }
  if (!blobs.length) return null;
  const em = (v: number) => v / fs;
  const out = blobs.map((k) => ({ top: em(by - k.top), bot: em(by - k.bot - 1), cx: em((k.l + k.r + 1) / 2 - ox), w: em(k.r - k.l + 1), h: em(k.bot - k.top + 1) }));
  const body = blobs[blobs.length - 1];
  const midRow = Math.round((blobs[0].top + body.bot) / 2);
  let stem = 0;
  for (let i = body.l; i < W && on(i, midRow); i++) stem++;
  return { blobs: out, stem: em(stem) };
}

export function initDotWave() {
  const line = document.querySelector<HTMLElement>(".overture-line");
  const body = line?.querySelector<HTMLElement>(".t-body");
  const dot = line?.querySelector<HTMLElement>(".breath");
  if (!line || !body || !dot) return { play: () => {} };
  const text = (body.textContent ?? "").trim();
  const io = text.indexOf("o", text.indexOf(" ") + 1); // the o of "more"
  const iI = text.lastIndexOf("i");
  if (!/^O/.test(text) || io < 0 || iI < 0) return { play: () => {} };

  let L: HTMLSpanElement[] = [];
  let G: { fs: number; base: number; home: Pt; D: number; letters: Letter[] } | null = null;
  const lt: { ty: number; sx: number; sy: number }[] = [];
  const hidden = new Set<number>();
  const D = { x: 0, y: 0, s: 1, sx: 1, sy: 1, rot: 0, op: 1 };
  const R = { x: 0, y: 0, w: 0, h: 0, b: 0, show: false };
  let ring: HTMLSpanElement, gA: Ghost, gB: Ghost;
  let busy = false, aborted = false;

  /** One span per letter, so letters can move; the line's text stays the same. */
  function split() {
    if (L.length) return;
    body!.textContent = "";
    L = [...text].map((ch) => {
      const s = document.createElement("span");
      s.className = "dw-t";
      s.textContent = ch;
      body!.appendChild(s);
      return s;
    });
    L.forEach(() => lt.push({ ty: 0, sx: 1, sy: 1 }));
    ring = document.createElement("span");
    ring.className = "dw-ring";
    ring.setAttribute("aria-hidden", "true");
    const ghost = (i: number): Ghost => {
      const el = document.createElement("span");
      el.className = "dw-ghost";
      el.setAttribute("aria-hidden", "true");
      el.textContent = text[i];
      line!.appendChild(el);
      return { el, i, dx: 0, dy: 0, s: 1, sx: 1, sy: 1, op: 0 };
    };
    line!.appendChild(ring);
    gA = ghost(io);
    gB = ghost(0);
  }

  function measure() {
    dot!.style.transform = "";
    L.forEach((s) => (s.style.transform = ""));
    const cs = getComputedStyle(line!);
    const fs = parseFloat(cs.fontSize);
    const font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    const lb = line!.getBoundingClientRect();
    const db = dot!.getBoundingClientRect();
    const base = (db.bottom - lb.top) / fs;
    const cache = new Map<string, ReturnType<typeof ink>>();
    const letters: Letter[] = L.map((s, i) => {
      const ch = text[i];
      const r = s.getBoundingClientRect();
      const left = (r.left - lb.left) / fs, top = (r.top - lb.top) / fs;
      if (!cache.has(ch)) cache.set(ch, ch.trim() ? ink(ch, font, fs) : null);
      const k = cache.get(ch);
      if (!k) return { ch, left, top, x: left + r.width / fs / 2, mid: 0, w: 0, h: 0, stem: 0 };
      const b = k.blobs, main = b[b.length - 1];
      const topInk = Math.max(...b.map((q) => q.top)), botInk = Math.min(...b.map((q) => q.bot));
      const l: Letter = { ch, left, top, x: left + main.cx, mid: (topInk + botInk) / 2, w: main.w, h: main.h, stem: k.stem };
      if (b.length > 1) l.tittle = { x: left + b[0].cx, y: (b[0].top + b[0].bot) / 2, w: b[0].w };
      return l;
    });
    const Dsize = db.width / fs;
    G = { fs, base, D: Dsize, home: { x: (db.left + db.width / 2 - lb.left) / fs, y: Dsize / 2 }, letters };
    for (const g of [gA, gB]) {
      g.el.style.left = `${letters[g.i].left}em`;
      g.el.style.top = `${letters[g.i].top}em`;
    }
  }

  function paint() {
    if (!G) return;
    dot!.style.opacity = String(D.op);
    dot!.style.transform = `translate(${D.x - G.home.x}em, ${G.home.y - D.y}em) rotate(${D.rot}rad) scale(${D.s * D.sx}, ${D.s * D.sy}) rotate(${-D.rot}rad)`;
    ring.style.visibility = R.show ? "visible" : "hidden";
    ring.style.width = `${R.w}em`;
    ring.style.height = `${R.h}em`;
    ring.style.borderWidth = `${R.b}em`;
    ring.style.transform = `translate(${R.x - R.w / 2}em, ${G.base - R.y - R.h / 2}em)`;
    for (const g of [gA, gB]) {
      const l = G.letters[g.i];
      g.el.style.transformOrigin = `${(l.x - l.left) * G.fs}px ${(G.base - l.top - l.mid) * G.fs}px`;
      g.el.style.transform = `translate(${g.dx}em, ${-g.dy}em) scale(${g.s * g.sx}, ${g.s * g.sy})`;
      g.el.style.opacity = String(g.op);
      g.el.style.visibility = g.op > 0 ? "visible" : "hidden";
    }
    L.forEach((s, i) => {
      const k = lt[i];
      s.style.transform = `translateY(${-k.ty}em) scale(${k.sx}, ${k.sy})`;
      s.style.opacity = hidden.has(i) ? "0" : "";
    });
  }

  const run = (dur: number, fn: (p: number) => void) =>
    new Promise<void>((res) => {
      if (aborted) return res();
      const t0 = performance.now();
      const f = (now: number) => {
        const p = aborted ? 1 : Math.min(1, (now - t0) / (dur * 1000));
        fn(p);
        paint();
        p < 1 ? requestAnimationFrame(f) : res();
      };
      requestAnimationFrame(f);
    });
  const wait = (s: number) => run(s, () => {});
  const squash = (o: Squashy, amt = 1, dur = 0.3) =>
    run(dur, (p) => {
      const s = Math.sin(p * Math.PI) * (1 - p) * amt;
      o.sx = 1 + 0.3 * s;
      o.sy = 1 - 0.28 * s;
    }).then(() => { o.sx = o.sy = 1; });
  const catchBy = (i: number, amt = 1) =>
    run(0.42, (p) => {
      const s = Math.sin(p * Math.PI) * Math.exp(-p * 2.2) * amt, k = lt[i];
      k.ty = -0.045 * s; k.sy = 1 - 0.07 * s; k.sx = 1 + 0.05 * s;
    });

  /** A real parabola (constant horizontal speed); crouch first, stretch along the velocity, squash on landing. */
  async function arc(from: Pt, to: Pt, o: { apex?: number; set: (x: number, y: number, p: number) => void; stretch?: Squashy; land?: boolean }) {
    const { apex = 0.4, set, stretch, land = true } = o;
    if (stretch) await run(BEATS.crouch, (p) => { const e = ease.out(p); stretch.sy = 1 - 0.28 * e; stretch.sx = 1 + 0.2 * e; });
    const dx = to.x - from.x, dist = Math.hypot(dx, to.y - from.y);
    const H = Math.max(from.y, to.y) + apex + dist * 0.05, a = from.y, c = to.y, b = 2 * H - (a + c) / 2;
    await run(0.3 + 0.11 * Math.sqrt(dist * 3), (p) => {
      set(from.x + dx * p, a * (1 - p) ** 2 + 2 * b * p * (1 - p) + c * p * p, p);
      if (!stretch) return;
      const vy = 2 * (b - a) * (1 - p) + 2 * (c - b) * p, v = Math.hypot(dx, vy);
      stretch.rot = Math.atan2(-vy, dx);
      const k = Math.min(0.3, v * 0.04) * Math.sin((Math.min(1, p * 1.6) * Math.PI) / 2) * (p < 0.88 ? 1 : (1 - p) / 0.12);
      stretch.sx = 1 + k; stretch.sy = 1 - k * 0.6;
    });
    set(to.x, to.y, 1);
    if (stretch) { stretch.rot = 0; stretch.sx = stretch.sy = 1; }
    if (land && stretch) await squash(stretch);
  }

  function rest() {
    Object.assign(D, { x: G!.home.x, y: G!.home.y, s: 1, sx: 1, sy: 1, rot: 0, op: 1 });
    R.show = false;
    gA.op = gB.op = 0;
    hidden.clear();
    lt.forEach((k) => Object.assign(k, { ty: 0, sx: 1, sy: 1 }));
    paint();
  }

  async function show() {
    const g = G!, lo = g.letters[io], LO = g.letters[0], li = g.letters[iI];
    if (!li.tittle) return;
    rest();

    // 1 → the dot of the i (grow to its size on the way, so they overlap exactly)
    const kI = li.tittle.w / g.D;
    await arc(g.home, li.tittle, { apex: 0.3, stretch: D, set: (x, y, p) => { D.x = x; D.y = y; D.s = lerp(1, kI, p); } });
    catchBy(iI, 0.8);
    await wait(BEATS.holdOnI);

    // 2 → hover over the o of "more", grow into it, drop in
    const hoverO = { x: lo.x, y: lo.mid + BEATS.hoverH };
    await arc(li.tittle, hoverO, { apex: 0.35, stretch: D, land: false, set: (x, y) => { D.x = x; D.y = y; } });
    await run(0.25, (p) => { D.y = hoverO.y + Math.sin(p * Math.PI) * 0.03; });
    const d0 = g.D * D.s;
    D.op = 0;
    Object.assign(R, { show: true, x: hoverO.x, y: hoverO.y, w: d0, h: d0, b: d0 / 2 });
    await run(BEATS.growO, (p) => {
      const e = ease.elastic(p), hole = ease.io(Math.min(1, p * 1.4));
      R.w = lerp(d0, lo.w, e); R.h = lerp(d0, lo.h, e); R.b = lerp(d0 / 2, lo.stem * 0.92, hole);
    });
    Object.assign(gA, { dx: 0, dy: BEATS.hoverH, s: 1, op: 0 });
    await run(0.12, (p) => { gA.op = p; });
    R.show = false;
    await run(BEATS.hoverAfterGrow, (p) => { gA.dy = BEATS.hoverH + Math.sin(p * Math.PI) * 0.025; });
    await run(BEATS.drop, (p) => { gA.dy = BEATS.hoverH * (1 - ease.in(p)); });
    hidden.add(io); gA.dy = 0;
    await squash(gA, 0.7);
    await wait(BEATS.holdOnO);

    // 3 → that o hops over the O of "One", swells into it, drops in, and is gone
    const hoverBig = { x: LO.x, y: LO.mid + BEATS.hoverH + 0.05 };
    hidden.delete(io);
    await arc({ x: lo.x, y: lo.mid }, hoverBig, { apex: 0.45, stretch: gA, land: false, set: (x, y) => { gA.dx = x - lo.x; gA.dy = y - lo.mid; } });
    const sFrom = lo.h / LO.h;
    Object.assign(gB, { dx: 0, dy: hoverBig.y - LO.mid, s: sFrom, op: 0 });
    await run(BEATS.growBig, (p) => {
      const e = ease.elastic(p), f = Math.min(1, p * 2.2);
      gB.s = lerp(sFrom, 1.08, e); gA.s = lerp(1, 1.08 / sFrom, e);
      gB.op = f; gA.op = 1 - f;
    });
    gA.op = 0; gA.s = 1;
    await run(0.16, (p) => { gB.dy = hoverBig.y - LO.mid + Math.sin(p * Math.PI) * 0.025; });
    const dy0 = gB.dy;
    await run(BEATS.drop, (p) => { const e = ease.in(p); gB.dy = dy0 * (1 - e); gB.s = lerp(1.08, 1, e); });
    hidden.add(0); gB.dy = 0; gB.s = 1;
    await squash(gB, 0.8);
    hidden.delete(0); gB.op = 0; paint();
    await wait(BEATS.holdBig);

    // 4 the O jumps: a wave to the end of the line; the full stop stands up again as the last one
    const n = L.length, step = BEATS.waveStep, rise = BEATS.waveRise, A = BEATS.waveHeight, kO = lt[0];
    await run(BEATS.crouch, (p) => { const e = ease.out(p); kO.sy = 1 - 0.12 * e; kO.sx = 1 + 0.06 * e; });
    const Orise = rise * 1.25, lastAt = Orise * 0.35 + step * n, total = lastAt + rise + 0.3;
    Object.assign(D, { x: g.home.x, y: g.home.y, s: 0, sx: 1, sy: 1, rot: 0, op: 1 });
    await run(total, (p) => {
      const t = p * total;
      const q0 = Math.min(1, t / Orise), up0 = Math.sin(q0 * Math.PI);
      kO.ty = BEATS.OJump * up0; kO.sy = q0 < 0.15 ? lerp(0.88, 1.06, q0 / 0.15) : 1 + 0.06 * up0; kO.sx = 1 - 0.03 * up0;
      for (let i = 1; i < n; i++) {
        if (!text[i].trim()) continue;
        const q = Math.min(1, Math.max(0, (t - Orise * 0.35 - i * step) / rise)), up = Math.sin(q * Math.PI), k = lt[i];
        k.ty = A * up; k.sy = 1 + 0.06 * up; k.sx = 1 - 0.03 * up;
      }
      const q = Math.min(1, Math.max(0, (t - lastAt) / rise));
      D.s = ease.back(Math.min(1, q * 2.2));
      D.y = g.home.y + A * 1.1 * Math.sin(q * Math.PI);
    });
    lt.forEach((k) => Object.assign(k, { ty: 0, sx: 1, sy: 1 }));
    Object.assign(D, { y: g.home.y, s: 1 });
    await squash(D, 0.5, 0.28);
  }

  async function play(delay = BEATS.restAfterDot) {
    if (busy) return;
    busy = true; aborted = false;
    split();
    line!.classList.add("dw-playing");
    await (document.fonts?.ready ?? Promise.resolve());
    measure();
    rest();
    const stop = (e: Event) => { if (e.target !== dot) aborted = true; };
    const evs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    evs.forEach((ev) => window.addEventListener(ev, stop, { passive: true }));
    try {
      await wait(delay);
      if (!aborted) await show();
    } finally {
      evs.forEach((ev) => window.removeEventListener(ev, stop));
      rest();
      line!.classList.remove("dw-playing");
      busy = false;
    }
  }

  dot.addEventListener("click", () => {
    if (document.documentElement.classList.contains("past-overture")) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    play(0.2);
  });
  addEventListener("resize", () => { if (!busy && G) { measure(); rest(); } });

  return { play };
}
