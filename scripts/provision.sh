#!/usr/bin/env bash
# One-time: create the production D1 database and R2 bucket, and write the D1 id into wrangler.jsonc.
# Run only after Gate A (docs/LAUNCH.md step 1). Safe to re-run: existing resources are reused.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! npx wrangler d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.exit(JSON.parse(s).some(d=>d.name==="omt")?0:1))'; then
  npx wrangler d1 create omt
fi
ID="$(npx wrangler d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).find(d=>d.name==="omt").uuid))')"
node -e '
  const fs = require("fs"); const p = "wrangler.jsonc";
  const s = fs.readFileSync(p, "utf8").replace(/"database_id": "[^"]*"/, `"database_id": "${process.argv[1]}"`);
  fs.writeFileSync(p, s);' "$ID"
echo "D1 omt = $ID (written to wrangler.jsonc)"

npx wrangler r2 bucket list | grep -q "omt-media" || npx wrangler r2 bucket create omt-media
echo "R2 omt-media ready"
npx wrangler types >/dev/null
echo "Next: npx wrangler d1 migrations apply omt --remote"
