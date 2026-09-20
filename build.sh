#!/usr/bin/env bash
# AFTERPRINT — production build.
#
# This project lives on a Windows path served into WSL, and npm resolves the
# win32 optional Rollup binary there, so a normal `vite build` cannot run from
# this directory inside WSL. It builds fine on Windows itself with `npm run build`.
#
# For verification here we drive esbuild directly. Font URLs are marked external
# so the /fonts/* paths stay absolute and resolve against the deployed root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
ESBUILD="${ESBUILD_BIN:-$(command -v esbuild || true)}"
MODULES="${APB_MODULES:-/tmp/apb/node_modules}"

if [ ! -x "$ESBUILD" ]; then
  for c in \
    /home/linux/earth-clone/node_modules/@esbuild/linux-x64/bin/esbuild \
    /home/linux/logiclab-os/node_modules/@esbuild/linux-x64/bin/esbuild \
    /home/linux/.hermes/hermes-agent/node_modules/@esbuild/linux-x64/bin/esbuild
  do
    [ -x "$c" ] && ESBUILD="$c" && break
  done
fi
[ -x "$ESBUILD" ] || { echo "esbuild not found" >&2; exit 1; }
echo "esbuild: $ESBUILD"
"$ESBUILD" --version

rm -rf "$OUT"
mkdir -p "$OUT"

# Bundle JS + CSS. esbuild follows the CSS import in main.tsx and emits it.
NODE_PATH="$MODULES" "$ESBUILD" "$ROOT/src/main.tsx" \
  --bundle \
  --minify \
  --format=esm \
  --target=es2020 \
  --jsx=automatic \
  --loader:.tsx=tsx \
  --loader:.ts=ts \
  --loader:.woff2=file \
  --external:/fonts/* \
  --define:process.env.NODE_ENV='"production"' \
  --outdir="$OUT/assets" \
  --entry-names=app \
  --log-level=warning

# Static assets ship beside the bundle.
cp -r "$ROOT/public/data" "$OUT/data"
cp -r "$ROOT/public/fonts" "$OUT/fonts"

# HTML shell.
cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f7f5ef" />
    <meta name="description" content="AFTERPRINT — 152,321 receipts from one person's digital life, read as chapters, threads, and connections. Frontend-only." />
    <title>AFTERPRINT — Your life, between the lines</title>
    <link rel="preload" href="./fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="./fonts/instrument-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="./assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/app.js"></script>
  </body>
</html>
HTML

echo ""
echo "=== dist ==="
ls -la "$OUT"
echo "--- assets ---"
ls -la "$OUT/assets"
echo "--- fonts ---"
ls "$OUT/fonts" | head
echo "--- data ---"
ls "$OUT/data"