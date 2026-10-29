#!/usr/bin/env bash
# Usage: fetch-build.sh <sha> <out.tgz>
# Downloads the site.tgz the "Deploy build" workflow made for <sha> (.github/workflows/deploy-build.yml).
# Exit 0: downloaded to <out.tgz>. 10: the GitHub build is not finished (try later). 20: no usable build (build here).
# 30: the GitHub build failed (do not deploy this commit). A run GitHub never started (billing) counts as 20.
# Needs ~/saigo/github-token: a fine-grained token with read access to this repository's Actions.
set -uo pipefail
SHA="$1"; OUT="$2"; REPO=INIRU/SAIGO-NO-DANTE; TOKEN_FILE=~/saigo/github-token
[ -s "$TOKEN_FILE" ] || exit 20
AUTH="Authorization: Bearer $(cat "$TOKEN_FILE")"
api() { curl -sSf -H "$AUTH" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$REPO/$1"; }

RUN=$(api "actions/workflows/deploy-build.yml/runs?head_sha=$SHA&per_page=1") || exit 20
STATUS=$(jq -r '.workflow_runs[0].status // "none"' <<<"$RUN")
CONCLUSION=$(jq -r '.workflow_runs[0].conclusion // ""' <<<"$RUN")
RUN_ID=$(jq -r '.workflow_runs[0].id // ""' <<<"$RUN")
case "$STATUS" in
  completed)
    if [ "$CONCLUSION" != success ]; then
      # A job GitHub never started (no runner, no steps: failed payment or spending limit) is no build, not a failed one.
      STARTED=$(api "actions/runs/$RUN_ID/jobs" | jq '[.jobs[] | select((.steps | length) > 0 or (.runner_name // "") != "")] | length') || exit 30
      [ "$STARTED" = 0 ] && exit 20
      exit 30
    fi ;;
  *) exit 10 ;;   # none (not started yet), queued, in_progress, waiting
esac

URL=$(api "actions/runs/$RUN_ID/artifacts" | jq -r --arg n "site-$SHA" '.artifacts[] | select(.name == $n and .expired == false) | .archive_download_url' | head -1)
[ -n "$URL" ] || exit 20
curl -sSfL -H "$AUTH" -o "$OUT.zip" "$URL" || { rm -f "$OUT.zip"; exit 20; }
python3 - "$OUT.zip" "$OUT" <<'EOF' || { rm -f "$OUT.zip" "$OUT"; exit 20; }
import shutil, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z, z.open('site.tgz') as src, open(sys.argv[2], 'wb') as dst:
    shutil.copyfileobj(src, dst)
EOF
rm -f "$OUT.zip"
