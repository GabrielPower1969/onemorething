import { describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";
import { verifyAccess } from "../../src/lib/access";

const TEAM = "gabriel.cloudflareaccess.com";
const AUD = "test-aud-tag";

async function setup() {
  const good = await generateKeyPair("RS256");
  const foreign = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(good.publicKey)), kid: "k1", alg: "RS256" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const sign = (key: CryptoKey, claims: Record<string, unknown> = {}, opts: { aud?: string; iss?: string; exp?: string } = {}) =>
    new SignJWT({ email: "gabriel@onemorething.today", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? `https://${TEAM}`)
      .setAudience(opts.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(key);
  return { good, foreign, jwks, sign };
}
const req = (token?: string) => new Request("https://onemorething.today/admin", { headers: token ? { "cf-access-jwt-assertion": token } : {} });

describe("verifyAccess", () => {
  it("accepts a valid Access token", async () => {
    const { good, jwks, sign } = await setup();
    const r = await verifyAccess(req(await sign(good.privateKey)), { teamDomain: TEAM, aud: AUD }, jwks);
    expect(r).toEqual({ ok: true, email: "gabriel@onemorething.today" });
  });
  it("fails closed when Access isn't configured", async () => {
    const { good, jwks, sign } = await setup();
    const r = await verifyAccess(req(await sign(good.privateKey)), { teamDomain: "", aud: "" }, jwks);
    expect(r.ok).toBe(false);
  });
  it.each([
    ["no token", async () => undefined],
    ["wrong audience", async (s: Awaited<ReturnType<typeof setup>>) => s.sign(s.good.privateKey, {}, { aud: "other-app" })],
    ["wrong issuer", async (s: Awaited<ReturnType<typeof setup>>) => s.sign(s.good.privateKey, {}, { iss: "https://evil.cloudflareaccess.com" })],
    ["expired", async (s: Awaited<ReturnType<typeof setup>>) => s.sign(s.good.privateKey, {}, { exp: "-1m" })],
    ["foreign signing key", async (s: Awaited<ReturnType<typeof setup>>) => s.sign(s.foreign.privateKey)],
    ["garbage", async () => "not.a.jwt"],
  ])("rejects %s", async (_name, make) => {
    const s = await setup();
    const token = await make(s as never);
    const r = await verifyAccess(req(token as string | undefined), { teamDomain: TEAM, aud: AUD }, s.jwks);
    expect(r.ok).toBe(false);
  });
});
