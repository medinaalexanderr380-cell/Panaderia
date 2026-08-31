#!/usr/bin/env bash
set -euo pipefail

# Development-only schema sync. Production schema changes are applied by
# Replit's Publish flow after it compares development and production.
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
