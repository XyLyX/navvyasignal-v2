#!/usr/bin/env bash
set -euo pipefail
archive=${1:?Supply an absolute path to the private editorial ZIP}
output=${2:?Supply an absolute path to the staging deployment ZIP}
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
python scripts/prepare-outlook-preview.py "$archive" "$work/manuscripts"
CI=true V2_CI_STATIC_FIXTURE=1 NEXT_PUBLIC_V2_PRODUCTION=false \
  STRATEGIC_OUTLOOK_PRIVATE_PREVIEW=true STRATEGIC_OUTLOOK_MANUSCRIPTS="$work/manuscripts" npm run build
mkdir "$work/deploy"
cp -R out/_next out/404.html out/strategic-outlook.html out/strategic-outlook.txt out/strategic-outlook "$work/deploy/"
cp "$work/manuscripts/assets/"* "$work/deploy/strategic-outlook/"
cd "$work/deploy"
for endpoint in rss.xml atom.xml feed.json; do
  test "$(cat "strategic-outlook/$endpoint")" = 'Not found'
  rm "strategic-outlook/$endpoint"
done
printf '/*\n  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet\n  Cache-Control: private, no-store\n' > _headers
printf '/ /strategic-outlook 302\n' > _redirects
printf 'User-agent: *\nDisallow: /\n' > robots.txt
python -m zipfile -c "$output" ./*
