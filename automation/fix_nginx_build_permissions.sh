#!/usr/bin/env bash
# Run on EC2 as ubuntu after clone + npm run build. Override HOME_DIR if needed.

set -euo pipefail

HOME_DIR="${HOME_DIR:-/home/ubuntu}"
APP="${APP:-$HOME_DIR/TravelMemory}"

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo "Run as ubuntu (not root); uses sudo only if needed." >&2
  exit 1
fi

if [[ ! -d "$APP/frontend/build" ]]; then
  echo "Missing $APP/frontend/build — run: cd $APP/frontend && npm run build" >&2
  exit 1
fi

# www-data must traverse home and parents, then read static files
chmod 755 "$HOME_DIR"
chmod 755 "$APP" "$APP/frontend"
chmod -R o+rX "$APP/frontend/build"

echo "OK: Nginx (www-data) can read $APP/frontend/build"
echo "Run: sudo nginx -t && sudo systemctl reload nginx"
