#!/usr/bin/env node
// Locale gate. Fails (exit 1) when en/zh drift apart or break the copy rules.
//   - identical key sets (types catch this too; this gives a readable diff)
//   - no empty values, no TODO/TBD/FIXME
//   - identical {placeholders} per key
//   - every WORK id in src/config/site.ts has work.<id>.{name,role,line}
//   - zh typography: no ASCII quotes, no spaces around ——, no space typed between CJK and Latin
// Node >= 22.6 strips TypeScript types natively, so the .ts sources are imported directly.
import { en } from "../src/i18n/en.ts";
import { zh } from "../src/i18n/zh.ts";
import { WORK } from "../src/config/site.ts";

const errors = [];
const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v]] : flat(v, `${prefix}${k}.`),
  );
const E = new Map(flat(en));
const Z = new Map(flat(zh));

for (const k of E.keys()) if (!Z.has(k)) errors.push(`zh is missing "${k}"`);
for (const k of Z.keys()) if (!E.has(k)) errors.push(`zh has extra key "${k}"`);

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
for (const [lang, map] of [["en", E], ["zh", Z]]) {
  for (const [k, v] of map) {
    if (!v.trim()) errors.push(`${lang}.${k} is empty`);
    if (/\b(TODO|TBD|FIXME)\b/.test(v)) errors.push(`${lang}.${k} contains a TODO marker`);
    if ((v.match(/\*/g) || []).length % 2) errors.push(`${lang}.${k} has an unbalanced *emphasis* marker`);
  }
}
for (const [k, v] of E) {
  if (Z.has(k) && placeholders(v) !== placeholders(Z.get(k)))
    errors.push(`placeholders differ for "${k}": en {${placeholders(v)}} vs zh {${placeholders(Z.get(k))}}`);
}

for (const { id } of WORK)
  for (const field of ["name", "role", "line"])
    if (!E.has(`work.${id}.${field}`)) errors.push(`site.ts WORK id "${id}" has no en work.${id}.${field}`);

const CJK = "\\p{Script=Han}";
// meta.* and rss.* end up in <title>, <meta> and feeds, where CSS autospace never applies,
// so those keys must type the space; everything else must not.
const plainText = (k) => /^(meta|rss)\./.test(k);
const spaced = new RegExp(`${CJK} [A-Za-z0-9]|[A-Za-z0-9] ${CJK}`, "u");
const unspaced = new RegExp(`${CJK}[A-Za-z0-9]|[A-Za-z0-9]${CJK}`, "u");
for (const [k, v] of Z) {
  if (/["']/.test(v)) errors.push(`zh.${k} uses ASCII quotes — use “ ” instead`);
  if (/\s——|——\s/.test(v)) errors.push(`zh.${k} has spaces around ——`);
  if (plainText(k) && unspaced.test(v)) errors.push(`zh.${k} is plain text — type a space between Chinese and Latin`);
  if (!plainText(k) && spaced.test(v)) errors.push(`zh.${k} types a space between Chinese and Latin — CSS text-autospace handles it`);
}

if (errors.length) {
  console.error(`i18n-check: ${errors.length} problem(s)\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log(`i18n-check: ok — ${E.size} keys in en and zh, ${WORK.length} work entries`);
