#!/usr/bin/env bash
# Builds the Chrome extension zips:
#   dist/job-search-clipper-<version>.zip  — upload to the Chrome Web Store
#   public/chrome-extension.zip            — the direct download on the site
# Both hold the same files, with manifest.json at the root of the zip.
set -euo pipefail
cd "$(dirname "$0")/../chrome-extension"

FILES=(manifest.json background.js content.js popup.js sidepanel.html icon16.png icon48.png icon128.png)
VERSION=$(node -p "require('./manifest.json').version")

mkdir -p ../dist
OUT="../dist/job-search-clipper-$VERSION.zip"
rm -f "$OUT" ../public/chrome-extension.zip
zip -q -X "$OUT" "${FILES[@]}"
cp "$OUT" ../public/chrome-extension.zip
echo "Built $OUT and public/chrome-extension.zip (version $VERSION)"
