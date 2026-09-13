#!/usr/bin/env node

// `output: "standalone"` deliberately omits `public/` and `.next/static/` from
// `.next/standalone/` (meant to be served by a CDN instead). Since `bin/gitscope.mjs`
// runs `.next/standalone/server.js` directly with no CDN in front of it, copy them in
// after every build so the standalone server can serve them itself.
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output

import { cpSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("copy-standalone-assets: .next/standalone not found — did `next build` run?");
  process.exit(1);
}

const copies = [
  [join(root, "public"), join(standalone, "public")],
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
];

for (const [src, dest] of copies) {
  if (!existsSync(src)) continue;
  cpSync(src, dest, { recursive: true });
  console.log(`copy-standalone-assets: copied ${src} -> ${dest}`);
}
