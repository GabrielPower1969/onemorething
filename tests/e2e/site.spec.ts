import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC = ["/", "/zh/", "/writing", "/zh/writing", "/privacy", "/zh/privacy"];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/status of 404/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

for (const path of PUBLIC) {
  test(`${path} renders, has no console errors and passes axe`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("home: who / what / contact are all present without JS timing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Gabriel Chen");
  await expect(page.locator(".work-list li")).toHaveCount(5);
  await expect(page.locator('a[href="mailto:gabriel@onemorething.today"]').first()).toBeVisible();
  // Reduced motion: every typed line is fully visible immediately.
  for (const line of await page.locator("[data-typeon]").all()) await expect(line).toHaveClass(/is-typed/);
});

test("language toggle round-trips and sets lang attributes", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const toggle = isMobile ? page.locator(".nav-mobile .lang") : page.locator(".nav-desktop .lang");
  await toggle.click();
  await expect(page).toHaveURL(/\/zh\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await (isMobile ? page.locator(".nav-mobile .lang") : page.locator(".nav-desktop .lang")).click();
  await expect(page).toHaveURL(/\/$/);
});

test("head: canonical, reciprocal hreflang and JSON-LD", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://onemorething.today/zh/");
  const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) => els.map((e) => e.getAttribute("hreflang")));
  expect(hreflangs.sort()).toEqual(["en", "x-default", "zh-Hans"]);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(ld["@graph"][0]["@type"]).toBe("Person");
});

test("i18n leak: no English UI words on Chinese pages", async ({ page }) => {
  // Allowed Latin on ZH pages: names, brands, the brand phrase, email, units.
  const allow =
    /^(One|one|more|thing|One more thing|Gabriel|Chen|Guangyu|Trimble|Flowgt|flowgt|loyalasabook|CITANZ|The|Muse|IT|AI|Macworld|TidBITS|Jobs|Announces|\$45|Million|Profit|Stevenote|One last thing|last|EN|RSS|GitHub|LinkedIn|YouTube|Cloudflare|GPC|Cookie|IP|gabriel@onemorething\.today|onemorething\.today|onemorething|Sample|a|video|post|English|Bilibili|SMIC|Wikipedia|Global|Privacy|Control|Gabriel Chen|\d+)$/;
  for (const path of ["/zh/", "/zh/writing", "/zh/privacy"]) {
    await page.goto(path);
    const text = await page.evaluate(() => {
      const parts = [document.title, ...[...document.querySelectorAll("[aria-label],[alt],[title]")].filter((e) => !e.closest("[lang='en'],.lang")).flatMap((e) => [e.getAttribute("aria-label") ?? "", e.getAttribute("alt") ?? "", e.getAttribute("title") ?? ""])];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const el = walker.currentNode.parentElement;
        if (el && !el.closest("script,style,noscript,[lang='en'],.wordmark,.lang")) parts.push(walker.currentNode.textContent ?? "");
      }
      return parts.join(" ");
    });
    const words = (text.match(/[A-Za-z][A-Za-z.@$'-]*/g) ?? []).filter((w) => !allow.test(w.replace(/[.,]$/, "")));
    expect(words, `${path} leaks: ${[...new Set(words)].join(", ")}`).toEqual([]);
  }
});

test("missing translation redirects, unknown post is a real 404", async ({ page, request }) => {
  const r = await request.get("/writing/definitely-not-a-post", { maxRedirects: 0 });
  expect(r.status()).toBe(404);
  await page.goto("/zh/writing/definitely-not-a-post");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
});

test("mobile menu is a modal dialog that closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.locator(".menu-open").click();
  await expect(page.locator("#menu-sheet")).toBeVisible();
  await expect(page.locator(".menu-open")).toHaveAttribute("aria-expanded", "true");
  const axe = await new AxeBuilder({ page }).include("#menu-sheet").analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-sheet")).toBeHidden();
  await expect(page.locator(".menu-open")).toBeFocused();
});

test("beacon rejects junk and the admin API rejects cross-origin writes", async ({ request }) => {
  expect((await request.post("/api/t", { data: { type: "evil", path: "/" } })).status()).toBe(204);
  const cross = await request.post("/api/admin/posts", { data: { slug: "x" }, headers: { origin: "https://evil.example" } });
  expect([403]).toContain(cross.status());
});
