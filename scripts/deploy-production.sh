#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_MODE="${INSTALL_MODE:-full}"
SKIP_BUILD="${SKIP_BUILD:-0}"

cd "$ROOT_DIR"

echo "[deploy] working directory: $ROOT_DIR"
echo "[deploy] node version: $(node -v)"
echo "[deploy] npm version: $(npm -v)"

if [[ "$INSTALL_MODE" == "runtime" ]]; then
  if [[ -f package-lock.json ]]; then
    echo "[deploy] running npm ci --omit=dev"
    npm ci --omit=dev
  else
    echo "[deploy] package-lock.json not found, running npm install --omit=dev"
    npm install --omit=dev
  fi
else
  if [[ -f package-lock.json ]]; then
    echo "[deploy] running npm ci"
    npm ci
  else
    echo "[deploy] package-lock.json not found, running npm install"
    npm install
  fi
fi

if [[ "$SKIP_BUILD" == "1" ]]; then
  if [[ ! -f dist/index.html ]]; then
    echo "[deploy] dist/index.html not found; cannot skip build without prebuilt frontend assets" >&2
    exit 1
  fi
  echo "[deploy] skipping frontend build because SKIP_BUILD=1"
else
  if [[ "$INSTALL_MODE" == "runtime" ]]; then
    echo "[deploy] cannot run build with INSTALL_MODE=runtime because devDependencies are not installed" >&2
    exit 1
  fi

  echo "[deploy] building production assets"
  npm run build
fi

echo "[deploy] deployment preparation completed"
