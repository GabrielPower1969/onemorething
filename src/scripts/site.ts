/** The one client module every public page loads. No framework, no dependencies. */
import { initBreath, initTypeOn } from "./typeon";
import { initTracking, setOptOut, trackingAllowed } from "./track";

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!els.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("reveal-ready");
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
    },
    { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
  );
  els.forEach((el) => {
    // Anything already on screen (e.g. back navigation) shows at once.
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-visible");
    else io.observe(el);
  });
}

/** Header turns dark while it sits over the black stage. */
function initStageHeader() {
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;
  const io = new IntersectionObserver(
    ([e]) => {
      const r = e.boundingClientRect;
      document.documentElement.classList.toggle("header-on-stage", r.top <= 36 && r.bottom >= 36);
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  );
  io.observe(stage);
}

function initMenu() {
  const sheet = document.querySelector<HTMLDialogElement>("#menu-sheet");
  const open = document.querySelector<HTMLButtonElement>(".menu-open");
  if (!sheet || !open) return;
  const close = sheet.querySelector<HTMLButtonElement>(".menu-close");
  open.addEventListener("click", () => {
    sheet.showModal();
    open.setAttribute("aria-expanded", "true");
  });
  close?.addEventListener("click", () => sheet.close());
  sheet.addEventListener("close", () => {
    open.setAttribute("aria-expanded", "false");
    open.focus();
  });
  sheet.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => sheet.close()));
}

function initCopy() {
  const status = document.querySelector<HTMLElement>("[data-copy-status]");
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy === "location" ? location.href.split("#")[0] : btn.dataset.copy!;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("is-done");
        if (status) status.textContent = btn.dataset.copiedLabel ?? "";
        setTimeout(() => btn.classList.remove("is-done"), 2000);
      } catch {}
    });
  });
}

function initVideo() {
  document.querySelectorAll<HTMLElement>("[data-video-embed]").forEach((box) => {
    const btn = box.querySelector("button");
    btn?.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = box.dataset.videoEmbed!;
      iframe.title = box.dataset.videoTitle ?? "YouTube";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      btn.parentNode?.replaceChild(iframe, btn);
      iframe.focus();
    });
  });
}

function initPrivacyToggle() {
  const btn = document.querySelector<HTMLButtonElement>("[data-optout]");
  if (!btn) return;
  const label = () => {
    const out = !trackingAllowed();
    btn.textContent = out ? btn.dataset.labelIn! : btn.dataset.labelOut!;
    btn.setAttribute("aria-pressed", String(out));
    const note = document.querySelector<HTMLElement>("[data-optout-note]");
    if (note) note.hidden = !out;
  };
  btn.addEventListener("click", () => {
    setOptOut(trackingAllowed());
    label();
  });
  label();
}

initTypeOn();
initBreath();
initReveal();
initStageHeader();
initMenu();
initCopy();
initVideo();
initPrivacyToggle();
initTracking();
