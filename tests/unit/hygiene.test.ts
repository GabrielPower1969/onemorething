import { describe, expect, it } from "vitest";
import { scanText } from "../../scripts/hygiene.mjs";

// Fixtures are assembled at runtime so this file itself never matches the scanner.
const j = (...parts: string[]) => parts.join("");

describe("hygiene scanner", () => {
  it.each([
    ["github-token", j("gh", "p_", "a".repeat(36))],
    ["aws-access-key", j("AK", "IA", "ABCDEFGHIJKLMNOP")],
    ["private-key", j("-----BEGIN ", "PRIVATE KEY-----")],
    ["assigned-secret", j("api_key", ' = "', "x".repeat(24), '"')],
    ["jwt", j("ey", "J", "a".repeat(12), ".ey", "J", "b".repeat(12), ".", "c".repeat(24))],
    ["nz-phone", j("call 0", "21 555 0", "123")],
    ["cn-national-id", j("110101", "1990", "0307", "123X")],
    ["email-not-allowlisted", j("someone", "@", "gmail.com")],
  ])("flags %s", (rule, line) => {
    expect((scanText("x.ts", `ok\n${line}\n`) as string[]).some((f) => f.endsWith(rule))).toBe(true);
  });

  it("never prints the matched value", () => {
    const secret = j("gh", "p_", "z".repeat(36));
    expect((scanText("x.ts", secret) as string[]).join(" ")).not.toContain(secret);
  });

  it("allows the site address and version pins", () => {
    expect(scanText("x.ts", "mailto:gabriel@onemorething.today and astro@7.3.8 and a@example.com")).toEqual([]);
  });
});
