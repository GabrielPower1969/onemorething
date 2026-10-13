#!/usr/bin/env node
// Data hygiene gate (same idea as loyalasabook's test_data_hygiene and flowgt's no-member-data).
// Fails (exit 1) when tracked files — or, with --history, any commit diff — contain:
//   - credentials (API tokens, private keys, cloud keys)
//   - personal data patterns (phone numbers, national ID / passport-like numbers)
//   - email addresses outside the allowlist
// Findings print file:line and the rule name only — never the matched value.
// Extra private terms (e.g. a home address) can be checked without committing them:
//   OMT_DENYLIST=~/.config/omt/denylist.txt node scripts/hygiene.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const SECRET_RULES = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["stripe-live-key", /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/],
  ["slack-token", /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/],
  ["assigned-secret", /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["'][^"'\s]{16,}["']/i],
  ["cloudflare-oauth", /\boauth_token\s*=\s*"[^"]{20,}"/],
];
const PERSONAL_RULES = [
  ["nz-phone", /(?<![\d.])(?:\+?64[\s-]?|0)2\d[\s-]?\d{3}[\s-]?\d{3,4}(?!\d)/],
  ["cn-national-id", /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/],
  ["passport-like", /\b(?:E[A-Z]|G|P)\d{7,8}\b/],
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_ALLOW = [
  /^gabriel@onemorething\.today$/i,
  /^noreply@anthropic\.com$/i,
  /@(?:example|test|invalid|localhost)(?:\.|$)/i,
  /@example\.(?:com|org|net)$/i,
  /^[a-z]+@[0-9]+\.[0-9]+\.[0-9]+$/i, // npm-style "pkg@1.2.3"
  /^[^@]+@(?:\d|x)/i, // "@1.2.3", "name@x.y" version pins
];
const SKIP = [/^package-lock\.json$/, /\.(png|jpe?g|webp|avif|ico|woff2?|gif|pdf)$/i, /^worker-configuration\.d\.ts$/];
// Files that intentionally contain fake credentials for tests.
const SECRET_FIXTURES = new Set(["scripts/hygiene.mjs", "tests/unit/hygiene.test.ts"]);

const deny = (() => {
  const p = (process.env.OMT_DENYLIST ?? "").replace(/^~/, homedir());
  if (!p || !existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.toLowerCase());
})();

export function scanText(path, text) {
  const findings = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    if (!SECRET_FIXTURES.has(path)) for (const [name, re] of SECRET_RULES) if (re.test(line)) findings.push(`${at}  ${name}`);
    for (const [name, re] of PERSONAL_RULES) if (re.test(line)) findings.push(`${at}  ${name}`);
    for (const m of line.match(EMAIL) ?? []) if (!EMAIL_ALLOW.some((re) => re.test(m))) findings.push(`${at}  email-not-allowlisted`);
    const lower = line.toLowerCase();
    for (const term of deny) if (lower.includes(term)) findings.push(`${at}  denylist`);
  });
  return findings;
}

function main() {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const findings = [];
  for (const path of git("ls-files").split("\n").filter(Boolean)) {
    if (SKIP.some((re) => re.test(path)) || !existsSync(path)) continue;
    findings.push(...scanText(path, readFileSync(path, "utf8")));
  }
  if (process.argv.includes("--history")) {
    // Only added lines of every commit, without author headers (commit metadata is not content).
    const log = git("log", "-p", "--all", "--no-color", "--format=commit %h", "--", ".", ":(exclude)package-lock.json");
    let commit = "";
    let file = "";
    for (const line of log.split("\n")) {
      if (line.startsWith("commit ")) commit = line.slice(7);
      else if (line.startsWith("+++ b/")) file = line.slice(6);
      else if (line.startsWith("+") && !line.startsWith("+++") && !SKIP.some((re) => re.test(file)) && !SECRET_FIXTURES.has(file)) {
        for (const [name, re] of SECRET_RULES) if (re.test(line)) findings.push(`history ${commit} ${file}  ${name}`);
      }
    }
  }
  if (findings.length) {
    console.error(`hygiene: ${findings.length} finding(s)\n  ${[...new Set(findings)].join("\n  ")}`);
    process.exit(1);
  }
  console.log(`hygiene: ok${process.argv.includes("--history") ? " (incl. history)" : ""}${deny.length ? `, ${deny.length} private terms checked` : ""}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
