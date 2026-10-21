#!/usr/bin/env bash
# End-to-end check for one site, against the fake Fulcra API.
# Usage: bash tools/e2e-site.sh sites/<id>
#
# Starts the fake API (8790) and the built site (4173), runs the site's own
# `npm run test:e2e` (which signs in by setting the fulcra_access_token cookie
# to FAKE_FULCRA_TOKEN), then checks the fake's write log against site.json.
set -euo pipefail

SITE_DIR="${1:?usage: bash tools/e2e-site.sh sites/<id>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="$(cd "$SITE_DIR" && pwd)"
WORK="$(mktemp -d)"
LOG="$WORK/fake-fulcra.jsonl"
: > "$LOG"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  # vite preview may leave a child behind; free the port.
  pkill -f "vite preview --port 4173" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

wait_for() { # url name
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$1"; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $2 at $1" >&2
  return 1
}

# A fake unsigned JWT, built at runtime so no token literal lives in the repo.
FAKE_TOKEN="$(node -e '
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
process.stdout.write(b({ alg: "none", typ: "JWT" }) + "." + b({ "fulcradynamics.com/userid": "e2e-visitor", exp }) + ".");
')"

node "$ROOT/tools/fake-fulcra/server.mjs" --port 8790 --log "$LOG" > "$WORK/fake.out" 2>&1 &
PIDS+=($!)
wait_for http://127.0.0.1:8790/__health "fake Fulcra API"

CLIENT_ID="$(sed -n 's/^PUBLIC_AUTH0_CLIENT_ID="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$SITE_DIR/.env.example" | head -n1)"
export PUBLIC_FULCRA_API_ENDPOINT="http://127.0.0.1:8790/"
export PUBLIC_AUTH0_DOMAIN="fulcra.us.auth0.com"
export PUBLIC_AUTH0_CLIENT_ID="$CLIENT_ID"

cd "$SITE_DIR"
npm ci
npm run build

npx vite preview --port 4173 --strictPort > "$WORK/preview.out" 2>&1 &
PIDS+=($!)
wait_for http://127.0.0.1:4173/ "site preview"

BASE_URL="http://127.0.0.1:4173" \
FAKE_FULCRA_URL="http://127.0.0.1:8790" \
FAKE_FULCRA_LOG="$LOG" \
FAKE_FULCRA_TOKEN="$FAKE_TOKEN" \
  npm run test:e2e

# The data-handoff assertion: a site that asks for sign-in must have written
# something for the visitor, and only under the paths it declared.
SITE_DIR="$SITE_DIR" LOG="$LOG" node --input-type=module -e '
import fs from "node:fs";
const site = JSON.parse(fs.readFileSync(process.env.SITE_DIR + "/site.json", "utf8"));
if (site.signInReason === null) { console.log("e2e ok (no sign-in, no write assertions)"); process.exit(0); }
const lines = fs.readFileSync(process.env.LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const mine = lines.filter((l) => l.userid === "e2e-visitor");
if (mine.length === 0) { console.error("no writes by e2e-visitor in the fake Fulcra log"); process.exit(1); }
const bad = lines.filter((l) => l.kind === "file" && !site.fulcraPaths.writes.some((p) => l.path.startsWith(p)));
if (bad.length) {
  for (const b of bad) console.error("file write outside declared paths: " + b.path);
  process.exit(1);
}
console.log("e2e ok: " + mine.length + " write(s) by e2e-visitor, all under declared paths");
'
