/** Admin behaviour: chart tooltip, post editor, settings. English-only UI by design. */
import { parseYouTubeId } from "../lib/youtube";
import { slugify } from "../lib/slug";
import type { Post } from "../lib/posts";

type Root = Document | HTMLElement;
const $ = <T extends Element = HTMLElement>(sel: string, root: Root = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: Root = document) => [...root.querySelectorAll<T>(sel)];

async function api<T = Record<string, unknown>>(method: string, url: string, body?: unknown, raw?: Blob): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method,
    headers: raw ? { "content-type": raw.type || "application/octet-stream" } : body ? { "content-type": "application/json" } : {},
    body: raw ?? (body ? JSON.stringify(body) : undefined),
    credentials: "same-origin",
  });
  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {}
  return { status: res.status, data };
}

// ---------------------------------------------------------------- chart tooltip
function initChart() {
  const wrap = $(".chart-wrap");
  const tip = $(".chart-tip", wrap ?? document);
  if (!wrap || !tip) return;
  const show = (el: SVGRectElement) => {
    const r = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    tip.textContent = el.dataset.tip ?? "";
    tip.style.left = `${r.left - w.left + r.width / 2}px`;
    tip.style.top = `${r.top - w.top + 8}px`;
    tip.classList.add("on");
  };
  const hide = () => tip.classList.remove("on");
  $$<SVGRectElement>(".bar-hit", wrap).forEach((el) => {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("focus", () => show(el));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("blur", hide);
  });
}

// ---------------------------------------------------------------- editor
type Lang = "en" | "zh";
const LANGS: Lang[] = ["en", "zh"];

function initEditor() {
  const form = $<HTMLFormElement>("[data-editor]");
  if (!form) return;
  const initial = JSON.parse($("#post-data")?.textContent || "null") as Post | null;
  let id = initial?.id ?? null;
  let status = initial?.status ?? "draft";
  let coverKey: string | null = initial?.cover_key ?? null;
  let slugTouched = !!initial?.slug;
  let dirty = false;
  let saving = false;
  const bufferKey = () => `omt_draft_${id ?? "new"}`;

  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  const kindValue = () => (form.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value ?? "text") as Post["kind"];
  const stateEl = $("[data-save-state]")!;
  const problemsEl = $("[data-problems]")!;
  const pill = $("[data-status-pill]")!;

  // ---- fill
  if (initial) {
    field("slug")!.value = initial.slug;
    (form.querySelector<HTMLInputElement>(`input[name="kind"][value="${initial.kind}"]`) ?? ({} as HTMLInputElement)).checked = true;
    field("youtube")!.value = initial.youtube_id ? `https://youtu.be/${initial.youtube_id}` : "";
    field("media_url")!.value = initial.media_url ?? "";
    for (const l of LANGS) {
      const t = initial.i18n[l];
      if (!t) continue;
      field(`${l}.title`)!.value = t.title;
      field(`${l}.summary`)!.value = t.summary;
      field(`${l}.body_md`)!.value = t.body_md;
      field(`${l}.cover_alt`)!.value = t.cover_alt;
    }
  }

  const collect = (nextStatus: string) => {
    const local = field("published_at")!.value;
    return {
      slug: field("slug")!.value.trim(),
      kind: kindValue(),
      status: nextStatus,
      cover_key: coverKey,
      youtube: field("youtube")!.value,
      media_url: field("media_url")!.value,
      // datetime-local is NZ wall time; let the server receive an explicit instant.
      published_at: local ? nzLocalToIso(local) : null,
      i18n: Object.fromEntries(
        LANGS.map((l) => [
          l,
          {
            title: field(`${l}.title`)!.value,
            summary: field(`${l}.summary`)!.value,
            body_md: field(`${l}.body_md`)!.value,
            cover_alt: field(`${l}.cover_alt`)!.value,
          },
        ]),
      ),
    };
  };

  // ---- tabs
  $$<HTMLButtonElement>("[data-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$<HTMLButtonElement>("[data-tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      $$<HTMLElement>(".lang-panel").forEach((p) => (p.hidden = p.dataset.lang !== tab.dataset.tab));
    }),
  );

  // ---- kind-dependent fields
  const syncKind = () => $$<HTMLElement>("[data-show-kind]").forEach((el) => (el.hidden = el.dataset.showKind !== kindValue()));
  form.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).name === "kind") syncKind();
  });
  syncKind();

  // ---- slug
  const slugPreview = $("[data-slug-preview]")!;
  const syncSlug = () => {
    if (!slugTouched) {
      const base = slugify(field("en.title")!.value) || slugify(field("zh.title")!.value);
      field("slug")!.value = base || (id ? "" : `post-${new Date().toISOString().slice(0, 10)}`);
    }
    slugPreview.textContent = field("slug")!.value;
  };
  field("slug")!.addEventListener("input", () => {
    slugTouched = true;
    syncSlug();
  });
  field("en.title")!.addEventListener("input", syncSlug);
  field("zh.title")!.addEventListener("input", syncSlug);
  syncSlug();

  // ---- youtube state
  const ytState = $("[data-yt-state]")!;
  const syncYt = () => {
    const v = field("youtube")!.value.trim();
    ytState.textContent = !v ? "" : parseYouTubeId(v) ? `✓ video id ${parseYouTubeId(v)}` : "Not a YouTube link";
  };
  field("youtube")!.addEventListener("input", syncYt);
  syncYt();

  // ---- completeness dots
  const syncDots = () => {
    for (const l of LANGS) {
      const ok = field(`${l}.title`)!.value.trim() && field(`${l}.summary`)!.value.trim() && (!coverKey || field(`${l}.cover_alt`)!.value.trim());
      $(`[data-dot="${l}"]`)?.classList.toggle("complete", !!ok);
    }
  };

  // ---- live preview (same sanitizer as the public site)
  const timers: Record<string, number> = {};
  const preview = (l: Lang) => {
    clearTimeout(timers[l]);
    timers[l] = window.setTimeout(async () => {
      const { data } = await api<{ html?: string }>("POST", "/api/admin/preview", { md: field(`${l}.body_md`)!.value });
      const box = $(`[data-preview="${l}"]`);
      if (box && typeof data.html === "string") box.innerHTML = data.html; // sanitized server-side
    }, 350);
  };
  LANGS.forEach((l) => {
    field(`${l}.body_md`)!.addEventListener("input", () => preview(l));
    preview(l);
  });

  // ---- cover
  const drop = $<HTMLButtonElement>("[data-cover-drop]")!;
  const file = $<HTMLInputElement>("[data-cover-file]")!;
  const showCover = () => {
    drop.querySelector("img")?.remove();
    if (coverKey) {
      const img = document.createElement("img");
      img.src = `/media/${coverKey}`;
      img.alt = "";
      drop.appendChild(img);
    }
    syncDots();
  };
  const upload = async (f: File) => {
    stateEl.textContent = "Uploading cover…";
    const { status: code, data } = await api<{ key?: string; error?: string }>("POST", "/api/admin/upload", undefined, f);
    if (code === 200 && data.key) {
      coverKey = data.key;
      markDirty();
      stateEl.textContent = "Cover uploaded.";
    } else stateEl.textContent = `Upload failed: ${data.error ?? code}`;
    showCover();
  };
  drop.addEventListener("click", () => file.click());
  file.addEventListener("change", () => file.files?.[0] && upload(file.files[0]));
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (f) upload(f);
  });
  $("[data-cover-yt]")?.addEventListener("click", async () => {
    stateEl.textContent = "Fetching YouTube thumbnail…";
    const { status: code, data } = await api<{ key?: string; error?: string }>("POST", "/api/admin/youtube-cover", { youtube: field("youtube")!.value });
    if (code === 200 && data.key) {
      coverKey = data.key;
      markDirty();
      stateEl.textContent = "Thumbnail copied.";
    } else stateEl.textContent = `Couldn't fetch thumbnail: ${data.error ?? code}`;
    showCover();
  });
  $("[data-cover-clear]")?.addEventListener("click", () => {
    coverKey = null;
    markDirty();
    showCover();
  });
  showCover();

  // ---- status UI
  const syncStatus = () => {
    pill.textContent = id ? status : "new";
    pill.className = `pill ${status}`;
    $("[data-publish]")!.textContent = status === "published" ? "Update" : "Publish";
    // On a live post "Save draft" would silently unpublish it — only Update/Unpublish are offered.
    $("[data-save]")!.hidden = status === "published";
    $("[data-unpublish]")!.hidden = status !== "published";
    $("[data-archive]")!.hidden = !id || status === "archived";
    const view = $<HTMLAnchorElement>("[data-view]")!;
    view.hidden = status !== "published";
    view.href = `/writing/${field("slug")!.value}`;
  };
  syncStatus();

  // ---- save
  const ERRORS: Record<string, string> = {
    "slug:invalid": "Slug: lowercase letters, numbers and dashes only.",
    "youtube:invalid": "That isn't a YouTube link.",
    "media_url:invalid": "Audio link must be a URL.",
    "media_url:https-only": "Audio link must start with https://",
    "i18n:no-complete-language": "Publishing needs at least one language with title, summary (and cover alt text if there's a cover).",
    "i18n.en:incomplete": "English is started but incomplete (title, summary, cover alt).",
    "i18n.zh:incomplete": "Chinese is started but incomplete (title, summary, cover alt).",
  };
  const save = async (nextStatus: string, quiet = false) => {
    if (saving) return false;
    saving = true;
    problemsEl.innerHTML = "";
    stateEl.textContent = quiet ? "Autosaving…" : "Saving…";
    const payload = collect(nextStatus);
    const { status: code, data } = await api<{ id?: string; error?: string; errors?: { field: string; code: string }[]; cover_key?: string }>(
      id ? "PUT" : "POST",
      id ? `/api/admin/posts/${id}` : "/api/admin/posts",
      payload,
    );
    saving = false;
    if (code === 200 && data.id) {
      const created = !id;
      id = data.id;
      status = nextStatus as Post["status"];
      if (data.cover_key && !coverKey) {
        coverKey = data.cover_key;
        showCover();
      }
      dirty = false;
      try {
        localStorage.removeItem("omt_draft_new");
        localStorage.removeItem(bufferKey());
      } catch {}
      if (created) history.replaceState(null, "", `/admin/posts/${id}`);
      stateEl.textContent = `${status === "published" ? "Published" : "Saved"} · ${new Date().toLocaleTimeString("en-NZ")}`;
      syncStatus();
      return true;
    }
    const list = data.errors?.map((e) => ERRORS[`${e.field}:${e.code}`] ?? `${e.field}: ${e.code}`) ?? [
      data.error === "slug-taken" ? "That slug is already used by another post." : `Save failed (${data.error ?? code}).`,
    ];
    problemsEl.innerHTML = list.map((m) => `<li>${m.replace(/</g, "&lt;")}</li>`).join("");
    stateEl.textContent = "";
    return false;
  };
  $("[data-save]")!.addEventListener("click", () => save("draft"));
  $("[data-publish]")!.addEventListener("click", () => save("published"));
  $("[data-unpublish]")!.addEventListener("click", () => save("draft"));
  $("[data-archive]")!.addEventListener("click", async () => {
    if (!id || !confirm("Take this post down? Its public URL will answer “gone”. You can republish it later.")) return;
    const { status: code } = await api("DELETE", `/api/admin/posts/${id}`);
    if (code === 200) {
      status = "archived";
      syncStatus();
      stateEl.textContent = "Taken down.";
    }
  });

  // ---- dirty tracking, crash buffer, autosave (drafts only — never touches a live post)
  function markDirty() {
    dirty = true;
    syncDots();
    try {
      localStorage.setItem(bufferKey(), JSON.stringify({ at: Date.now(), data: collect(status) }));
    } catch {}
  }
  form.addEventListener("input", markDirty);
  setInterval(() => {
    if (!dirty || saving || status === "published" || status === "archived") return;
    const p = collect("draft");
    if (!p.slug || !(p.i18n.en.title || p.i18n.zh.title || p.i18n.en.body_md || p.i18n.zh.body_md)) return;
    save("draft", true);
  }, 10_000);
  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault();
  });

  // Offer to restore an unsaved buffer that is newer than the server copy.
  try {
    const buf = JSON.parse(localStorage.getItem(bufferKey()) || "null") as { at: number; data: ReturnType<typeof collect> } | null;
    const serverAt = initial ? Date.parse(initial.updated_at) : 0;
    if (buf && buf.at > serverAt + 2000 && confirm("This post has unsaved changes from an earlier session. Restore them?")) {
      const d = buf.data;
      field("slug")!.value = d.slug;
      slugTouched = true;
      field("youtube")!.value = d.youtube ?? "";
      field("media_url")!.value = d.media_url ?? "";
      for (const l of LANGS) for (const k of ["title", "summary", "body_md", "cover_alt"] as const) field(`${l}.${k}`)!.value = d.i18n[l][k];
      coverKey = d.cover_key;
      showCover();
      LANGS.forEach(preview);
      dirty = true;
    }
  } catch {}
  syncDots();
}

/** "2026-10-13T09:30" in Pacific/Auckland → ISO instant. */
function nzLocalToIso(local: string): string {
  const guess = new Date(`${local}:00Z`);
  const nzOffsetMin = (d: Date) => {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Auckland", timeZoneName: "longOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = s?.match(/GMT([+-])(\d{2}):(\d{2})/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 720;
  };
  return new Date(guess.getTime() - nzOffsetMin(guess) * 60_000).toISOString();
}

// ---------------------------------------------------------------- settings
function initSettings() {
  const form = $<HTMLFormElement>("[data-settings]");
  if (!form) return;
  const state = $("[data-save-state]", form)!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    state.textContent = "Saving…";
    const { status, data } = await api<{ error?: string; lang?: string }>("PUT", "/api/admin/settings", {
      featured: { en: { youtube: v("en.youtube"), title: v("en.title") }, zh: { youtube: v("zh.youtube"), title: v("zh.title") } },
    });
    state.textContent = status === 200 ? "Saved." : `Not saved: ${data.error ?? status}${data.lang ? ` (${data.lang})` : ""}`;
  });
}

initChart();
initEditor();
initSettings();
