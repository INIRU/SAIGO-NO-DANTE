#!/usr/bin/env bash
# Usage: PREBUILT=<site.tgz> bash ~/saigo/deploy.sh <sha>          (the GitHub build, see fetch-build.sh)
#        git archive --format=tar.gz <rev> | bash ~/saigo/deploy.sh <sha>   (fallback: build here)
# Either way the new app is the standalone output (server.js + .next + node_modules + public), swapped in next to the
# live app (a few seconds down), rolled back if it does not answer.
set -euo pipefail
SHA="$1"; APP=~/saigo/app; NEW=~/saigo/app-new; OLD=~/saigo/app-old; SRC=~/saigo/build-src
rm -rf "$NEW"; mkdir -p "$NEW"
if [ -n "${PREBUILT:-}" ]; then
  tar -xzf "$PREBUILT" -C "$NEW"; rm -f "$PREBUILT"
else
  rm -rf "$SRC"; mkdir -p "$SRC"; tar -xzf - -C "$SRC"
  ln -s ~/saigo/env.production "$SRC/.env.production.local"
  cd "$SRC"; npm ci --no-audit --no-fund --loglevel=error
  # Type checking is the job of CI. Here TypeScript 7 ran its own tsc (~1.75GB) next to the build and the live app, ran
  # the box out of memory and froze the site (2026-10-22). nice keeps the live site responsive.
  if ! SKIP_BUILD_TYPECHECK=1 NEXT_PUBLIC_BUILD_SHA="$SHA" NODE_OPTIONS=--max-old-space-size=3072 NEXT_TELEMETRY_DISABLED=1 nice -n 10 npm run build > ~/saigo/build.log 2>&1; then
    tail -30 ~/saigo/build.log; echo "build failed, live app untouched"; exit 1
  fi
  cp -R .next/standalone/. "$NEW/"; cp -R .next/static "$NEW/.next/static"; cp -R public/. "$NEW/public/"
  cd ~; rm -rf "$SRC"
fi
[ -f "$NEW/server.js" ] || { echo "no server.js in the new app, live app untouched"; exit 1; }
ln -sfn ~/saigo/env.production "$NEW/.env.production.local"; echo "$SHA" > "$NEW/REVISION"
# Optimized images survive deploys: every app points at one shared cache (else each deploy re-encodes thousands with sharp).
mkdir -p ~/saigo/cache/images "$NEW/.next/cache"; rm -rf "$NEW/.next/cache/images"; ln -s ~/saigo/cache/images "$NEW/.next/cache/images"
rm -rf "$OLD"; sudo systemctl stop saigo-web; mv "$APP" "$OLD"; mv "$NEW" "$APP"; sudo systemctl start saigo-web
for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3000/ko && { echo "deployed $SHA"; exit 0; }; sleep 1; done
echo "health check failed, rolling back"; sudo systemctl stop saigo-web; rm -rf ~/saigo/app-failed; mv "$APP" ~/saigo/app-failed; mv "$OLD" "$APP"; sudo systemctl start saigo-web; exit 1
