#!/usr/bin/env bash
# Backup = D1 export + every R2 cover listed in the media table + wrangler.jsonc, as one dated tarball.
# Usage: BACKUP_DIR=~/Backups/omt scripts/backup.sh [--local]
# Run weekly (inside D1's 7-day Time Travel window on the free plan).
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="--remote"
[[ "${1:-}" == "--local" ]] && TARGET="--local"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/media" "$BACKUP_DIR"
echo "→ exporting D1 ($TARGET)"
npx wrangler d1 export omt "$TARGET" --output "$WORK/omt.sql"

echo "→ downloading covers listed in the media table"
KEYS="$(npx wrangler d1 execute omt "$TARGET" --json --command "SELECT key FROM media" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s)[0].results)console.log(r.key)})')"
COUNT=0
for key in $KEYS; do
  [[ "$key" =~ ^[a-z0-9-]+\.(jpg|png|webp|avif)$ ]] || { echo "  skip unexpected key: $key"; continue; }
  npx wrangler r2 object get "omt-media/$key" "$TARGET" --file "$WORK/media/$key" >/dev/null
  COUNT=$((COUNT + 1))
done
cp wrangler.jsonc "$WORK/"

OUT="$BACKUP_DIR/omt-$STAMP.tar.gz"
tar -czf "$OUT" -C "$WORK" .
echo "✓ $OUT  (D1 + $COUNT covers)"
