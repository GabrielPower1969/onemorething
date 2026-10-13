import { describe, expect, it } from "vitest";
import { appOf, deviceOf, isBot, nzDay, parseEvent, visitorHash } from "../../src/lib/analytics";

describe("parseEvent", () => {
  it("accepts a pageview", () => {
    expect(parseEvent({ type: "pageview", path: "/zh/", lang: "zh", ref: "LinkedIn.com" })).toEqual({
      type: "pageview",
      path: "/zh/",
      lang: "zh",
      ref: "linkedin.com",
    });
  });
  it.each([
    [{ type: "evil", path: "/" }],
    [{ type: "pageview", path: "https://evil.example/" }],
    [{ type: "pageview", path: "/<script>" }],
    [{ type: "pageview", path: "/" + "a".repeat(300) }],
    [{ type: "out", path: "/", target: "not-a-configured-target" }],
    [null],
    ["pageview"],
  ])("drops %j", (input) => expect(parseEvent(input)).toBeNull());

  it("drops unknown sections/campaigns but keeps the event", () => {
    const e = parseEvent({ type: "section", path: "/", section: "<img>", campaign: "person-123" });
    expect(e).toEqual({ type: "section", path: "/", lang: "en" });
  });
  it("keeps configured outbound targets and clamps values", () => {
    expect(parseEvent({ type: "out", path: "/", target: "flowgt", section: "work" })?.target).toBe("flowgt");
    expect(parseEvent({ type: "engage", path: "/", value: 1e9 })?.value).toBe(86_400);
  });
});

describe("visitor hash", () => {
  it("is stable within a salt and changes with the salt", async () => {
    const a = await visitorHash("salt-a", "203.0.113.7", "UA");
    expect(a).toHaveLength(16);
    expect(await visitorHash("salt-a", "203.0.113.7", "UA")).toBe(a);
    expect(await visitorHash("salt-b", "203.0.113.7", "UA")).not.toBe(a);
  });
});

describe("request classification", () => {
  it("detects bots and in-app browsers", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 (Macintosh) HeadlessChrome/155")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/155 Safari/537.36")).toBe(false);
    expect(appOf("Mozilla/5.0 (iPhone) MicroMessenger/8.0")).toBe("wechat");
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 18_0)")).toBe("tablet");
  });
  it("uses New Zealand days", () => {
    // 2026-10-13 11:30 UTC is 2026-10-14 00:30 in NZ (NZDT, UTC+13).
    expect(nzDay(new Date("2026-10-13T11:30:00Z"))).toBe("2026-10-14");
  });
});
