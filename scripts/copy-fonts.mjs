#!/usr/bin/env node
// Copies the self-hosted Latin font files from node_modules into public/fonts so they are served
// same-origin with stable URLs (preloadable, cache-forever). Runs before dev and build.
import { copyFileSync, mkdirSync } from "node:fs";

const SRC = "node_modules/@fontsource-variable/newsreader/files";
const files = ["newsreader-latin-opsz-normal.woff2", "newsreader-latin-opsz-italic.woff2"];
mkdirSync("public/fonts", { recursive: true });
for (const f of files) copyFileSync(`${SRC}/${f}`, `public/fonts/${f}`);
console.log(`copy-fonts: ${files.length} files → public/fonts`);
