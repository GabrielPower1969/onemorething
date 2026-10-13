import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Cloudflare Access verification for /admin and /api/admin.
 * Access sits in front of these paths; this check is the second lock, so a misconfigured
 * Access app (or a request that reaches the Worker another way) still gets a 403.
 * Fails closed: no team domain or AUD configured → nobody gets in (except local dev).
 */
export type AccessConfig = { teamDomain: string; aud: string };
export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export async function verifyAccess(
  request: Request,
  config: AccessConfig,
  keyResolver?: Parameters<typeof jwtVerify>[1],
): Promise<AccessResult> {
  const teamDomain = config.teamDomain.trim();
  const aud = config.aud.trim();
  if (!teamDomain || !aud) return { ok: false, reason: "access-not-configured" };
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return { ok: false, reason: "missing-token" };
  try {
    const { payload } = await jwtVerify(token, keyResolver ?? jwksFor(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: aud,
      algorithms: ["RS256"],
    });
    return { ok: true, email: emailOf(payload) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : "invalid-token" };
  }
}

const emailOf = (p: JWTPayload) => (typeof p.email === "string" ? p.email : "service-token");

/** Only `astro dev` on localhost skips Access. A production build can never take this path. */
export function isLocalDev(url: URL): boolean {
  return import.meta.env.DEV && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}
