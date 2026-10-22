#!/usr/bin/env bash
# Run by saigo-deploy.timer every 2 minutes: deploys origin/main when it moves. Takes the GitHub build of that commit
# (fetch-build.sh); while it is still building, waits for the next run; if there is no GitHub build within 20 minutes
# (or no token), builds here. A revision that failed is skipped until main moves again.
set -euo pipefail
exec 9>~/saigo/deploy.lock; flock -n 9 || exit 0
cd ~/saigo/src
git fetch -q --depth 1 origin main
NEW=$(git rev-parse FETCH_HEAD)
[ "$NEW" = "$(cat ~/saigo/app/REVISION 2>/dev/null)" ] && exit 0
[ "$NEW" = "$(cat ~/saigo/failed-rev 2>/dev/null)" ] && exit 0
TGZ=~/saigo/site-$NEW.tgz
set +e; bash ~/saigo/fetch-build.sh "$NEW" "$TGZ"; RC=$?; set -e
if [ "$RC" = 10 ]; then
  FIRST=$(awk -v s="$NEW" '$1 == s { print $2 }' ~/saigo/waiting 2>/dev/null || true)
  [ -n "$FIRST" ] || { FIRST=$(date +%s); echo "$NEW $FIRST" > ~/saigo/waiting; }
  if [ $(( $(date +%s) - FIRST )) -lt 1200 ]; then echo "waiting for the GitHub build of $NEW"; exit 0; fi
  echo "no GitHub build of $NEW after 20 minutes"; RC=20
fi
rm -f ~/saigo/waiting
if [ "$RC" = 30 ]; then echo "GitHub build of $NEW failed, not deploying"; echo "$NEW" > ~/saigo/failed-rev; exit 1; fi
echo "deploying $NEW ($([ "$RC" = 0 ] && echo 'GitHub build' || echo 'building here'))"
if [ "$RC" = 0 ]; then
  PREBUILT="$TGZ" bash ~/saigo/deploy.sh "$NEW" < /dev/null && OK=1 || OK=0
else
  git archive --format=tar.gz "$NEW" | bash ~/saigo/deploy.sh "$NEW" && OK=1 || OK=0
fi
rm -f "$TGZ"
if [ "$OK" = 1 ]; then rm -f ~/saigo/failed-rev; else echo "$NEW" > ~/saigo/failed-rev; exit 1; fi
