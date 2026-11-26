#!/usr/bin/env bash
# Retakes the app screenshots on the landing page (public/hero/*.webp) from a
# fictional demo account, and updates their sizes in LandingPage.tsx.
#
#   pnpm shots:landing                     every app shot
#   pnpm shots:landing fitness ats         just these (names in shoot.mts)
#   pnpm shots:landing --with-extension    also the Chrome extension shots
#   SHOTS_NO_BUILD=1 pnpm shots:landing    reuse the current `next build`
#
# Needs Google Chrome and Python with Pillow. Uses a throwaway database and
# `next start`, so it doesn't touch your data or a running dev server.
set -euo pipefail
cd "$(dirname "$0")/../.."
HERE=scripts/landing-shots
PORT=${SHOTS_PORT:-3471}
EXT=0
SHOTS=()
for a in "$@"; do [[ $a == --with-extension ]] && EXT=1 || SHOTS+=("$a"); done

WORK=$(mktemp -d)
SERVER=
cleanup() { [[ -n $SERVER ]] && kill "$SERVER" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is in use; set SHOTS_PORT to another port." >&2; exit 1
fi
python3 -c "import PIL" 2>/dev/null || { echo "Python Pillow is required (pip install pillow)." >&2; exit 1; }

export SHOTS_DB=$WORK/demo.db SHOTS_OUT=$WORK/out SHOTS_BASE=http://localhost:$PORT
mkdir -p "$SHOTS_OUT"
SECRET=landing-shots-$(openssl rand -hex 8)

echo "Seeding the demo account…"
TURSO_DATABASE_URL=file:$SHOTS_DB ./node_modules/.bin/tsx --tsconfig tsconfig.json $HERE/seed.mts >/dev/null
export SHOTS_COOKIE=$(SHOTS_SECRET=$SECRET node -e '
  const { createClient } = require("@libsql/client");
  const crypto = require("crypto");
  createClient({ url: "file:" + process.env.SHOTS_DB })
    .execute("SELECT id FROM users WHERE email = '"'demo@example.com'"'")
    .then((r) => { const id = String(r.rows[0].id); console.log(`jbs_session=${id}.${crypto.createHmac("sha256", process.env.SHOTS_SECRET).update(id).digest("base64url")}`); });')

[[ -n ${SHOTS_NO_BUILD:-} ]] || { echo "Building…"; pnpm -s build >/dev/null; }

echo "Starting the app on :${PORT}…"
TURSO_DATABASE_URL=file:$SHOTS_DB SESSION_SECRET=$SECRET MCP_PUBLIC_ORIGIN=https://jobs.fieldlines.org \
  ./node_modules/.bin/next start -p "$PORT" >"$WORK/server.log" 2>&1 &
SERVER=$!
for _ in $(seq 60); do curl -sf -o /dev/null "$SHOTS_BASE/login" && break; sleep 1; done
curl -sf -o /dev/null "$SHOTS_BASE/login" || { cat "$WORK/server.log" >&2; exit 1; }

echo "Capturing…"
./node_modules/.bin/tsx $HERE/shoot.mts ${SHOTS[@]+"${SHOTS[@]}"}
if (( EXT )); then ./node_modules/.bin/tsx $HERE/ext.mts; fi

echo "Writing public/hero…"
python3 $HERE/compose.py $( (( EXT )) && echo --with-extension )
