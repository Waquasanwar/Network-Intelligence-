#!/usr/bin/env bash
# Build on Vercel: apply migrations, load demo data once if asked, then build the app.
set -euo pipefail

# Vercel's Neon integration names the direct (unpooled) connection DATABASE_URL_UNPOOLED;
# Prisma migrations read DIRECT_URL. Use whichever is set.
export DIRECT_URL="${DIRECT_URL:-${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}}"
if [ -z "${DATABASE_URL:-}" ]; then echo "DATABASE_URL is not set. Connect a Neon database to this project in Vercel → Storage." >&2; exit 1; fi

npx prisma migrate deploy

# Demo data, for a test deployment only. The seed wipes tables first, so it runs only when
# SEED_DEMO_DATA=true AND the database has no users yet. It never touches a database in use.
if [ "${SEED_DEMO_DATA:-}" = "true" ]; then node scripts/seed-if-empty.mjs; fi

npx next build
