#!/usr/bin/env node
// Post-deploy security check against the live site (black-box, read-only).
//   node scripts/security-check.mjs                    # https://onemorething.today
//   OMT_RESOLVE=104.21.6.22 node scripts/security-check.mjs   # bypass a stale local DNS cache
// Exit 1 if any check fails. Zone settings this script can't see (min TLS, Bot Fight Mode, DMARC)
// are listed in docs/SECURITY.md.
import https from "node:https";
import http from "node:http";

const HOST = process.env.OMT_HOST ?? "onemorething.today";
const RESOLVE = process.env.OMT_RESOLVE;
const HSTS = "max-age=31536000; includeSubDomains; preload";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";

function request(url, { method = "GET", headers = {}, body } = {}) {
  const u = new URL(url);
  const lib = u.protocol === "https:" ? https : http;
  const lookup = RESOLVE ? (_h, opts, cb) => (opts?.all ? cb(null, [{ address: RESOLVE, family: 4 }]) : cb(null, RESOLVE, 4)) : undefined;
  return new Promise((resolve, reject) => {
    const req = lib.request(u, { method, headers: { "user-agent": UA, ...headers }, lookup, servername: u.hostname }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    if (body) req.write(body);
    req.end();
  });
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

const base = `https://${HOST}`;
const page = await request(`${base}/`);
const h = page.headers;
const csp = String(h["content-security-policy"] ?? "");

check("http → https 301", ...(await request(`http://${HOST}/zh/?a=1`).then((r) => [r.status === 301 && r.headers.location === `${base}/zh/?a=1`, `${r.status} ${r.headers.location ?? ""}`])));
check("www → apex 301", ...(await request(`https://www.${HOST}/writing`).then((r) => [r.status === 301 && r.headers.location === `${base}/writing`, `${r.status} ${r.headers.location ?? ""}`])));
check("home 200", page.status === 200, String(page.status));
check("HSTS with preload", h["strict-transport-security"] === HSTS, h["strict-transport-security"]);
check("X-Frame-Options DENY", h["x-frame-options"] === "DENY", h["x-frame-options"]);
check("COOP same-origin", h["cross-origin-opener-policy"] === "same-origin");
check("CORP same-origin", h["cross-origin-resource-policy"] === "same-origin");
check("nosniff", h["x-content-type-options"] === "nosniff");
check("Referrer-Policy", h["referrer-policy"] === "strict-origin-when-cross-origin");
check("Permissions-Policy", String(h["permissions-policy"] ?? "").includes("camera=()"));
check("CSP hashed scripts, no unsafe-inline", /script-src[^;]*'sha256-/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp));
check("CSP frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"));
check("CSP upgrade-insecure-requests", csp.includes("upgrade-insecure-requests"));
check("HTML no-transform", String(h["cache-control"] ?? "").includes("no-transform"), h["cache-control"]);
check("public page indexable", !h["x-robots-tag"], h["x-robots-tag"] ?? "");
const external = [...page.body.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((s) => !s.startsWith(base));
check("no third-party scripts", external.length === 0 && !page.body.includes("cloudflareinsights"), external.join(" "));

const asset = await request(`${base}/favicon.svg`);
check("static file gets headers too", asset.headers["strict-transport-security"] === HSTS && asset.headers["x-frame-options"] === "DENY", `${asset.status}`);
check("static file locked CSP", String(asset.headers["content-security-policy"] ?? "").startsWith("default-src 'none'"));

const sec = await request(`${base}/.well-known/security.txt`);
const expires = Date.parse((sec.body.match(/^Expires: (.+)$/m) ?? [])[1] ?? "");
check("security.txt", sec.status === 200 && String(sec.headers["content-type"]).startsWith("text/plain") && /^Contact: /m.test(sec.body), `${sec.status} ${sec.headers["content-type"]}`);
check("security.txt not expiring < 30 days", expires - Date.now() > 30 * 86_400_000, Number.isNaN(expires) ? "no Expires" : new Date(expires).toISOString());
check("/security.txt alias 301", ...(await request(`${base}/security.txt`).then((r) => [r.status === 301, `${r.status} ${r.headers.location ?? ""}`])));

check("/admin locked without Access", (await request(`${base}/admin`)).status === 403);
check("/api/admin locked without Access", (await request(`${base}/api/admin/posts`)).status === 403);
check(
  "cross-origin admin write refused",
  (await request(`${base}/api/admin/posts`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })).status === 403,
);
check(
  "beacon drops junk silently",
  (await request(`${base}/api/t`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"type":"evil","path":"/"}' })).status === 204,
);
check("unknown post 404", (await request(`${base}/writing/definitely-not-a-post`)).status === 404);

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(width)}  ${r.ok ? "" : r.detail ?? ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
