#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-travelmemory-net}"
MONGO_NAME="${MONGO_NAME:-travel-mongo}"
BACKEND_NAME="${BACKEND_NAME:-travel-backend}"
FRONTEND_NAME="${FRONTEND_NAME:-travel-frontend}"
MONGO_VOLUME="${MONGO_VOLUME:-travelmemory-mongo-data}"

REMOVE_NETWORK=false
REMOVE_VOLUME=false
for arg in "$@"; do
  case "$arg" in
    --remove-network) REMOVE_NETWORK=true ;;
    --remove-volume) REMOVE_VOLUME=true ;;
  esac
done

docker rm -f "$FRONTEND_NAME" 2>/dev/null || true
docker rm -f "$BACKEND_NAME" 2>/dev/null || true
docker rm -f "$MONGO_NAME" 2>/dev/null || true

if [[ "$REMOVE_NETWORK" == true ]]; then
  docker network rm "$NETWORK" 2>/dev/null || true
  echo "Removed network ${NETWORK} (if it existed)."
else
  echo "Network ${NETWORK} left in place. Remove with: docker network rm ${NETWORK}"
fi

if [[ "$REMOVE_VOLUME" == true ]]; then
  docker volume rm "$MONGO_VOLUME" 2>/dev/null || true
  echo "Removed volume ${MONGO_VOLUME} (if it existed and was unused)."
fi

echo "Containers stopped and removed."
if [[ "$REMOVE_VOLUME" != true ]]; then
  echo "MongoDB data kept in volume ${MONGO_VOLUME}. Wipe with: scripts/docker-down.sh --remove-volume"
fi
