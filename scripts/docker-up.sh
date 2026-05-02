#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="${NETWORK:-travelmemory-net}"
MONGO_NAME="${MONGO_NAME:-travel-mongo}"
BACKEND_NAME="${BACKEND_NAME:-travel-backend}"
FRONTEND_NAME="${FRONTEND_NAME:-travel-frontend}"
BACKEND_IMAGE="${BACKEND_IMAGE:-travelmemory-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-travelmemory-frontend}"
MONGO_URI="${MONGO_URI:-mongodb://${MONGO_NAME}:27017/travelmemory}"
MONGO_VOLUME="${MONGO_VOLUME:-travelmemory-mongo-data}"

echo "Building images…"
docker build -t "$BACKEND_IMAGE" "$ROOT/backend"
docker build -t "$FRONTEND_IMAGE" "$ROOT/frontend" \
  --build-arg "REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL:-http://localhost:3001}"

echo "Creating network ${NETWORK} (ignored if it already exists)…"
docker network create "$NETWORK" 2>/dev/null || true

if docker ps -a --format '{{.Names}}' | grep -qx "$MONGO_NAME"; then
  echo "Remove existing container: docker rm -f $MONGO_NAME" >&2
  exit 1
fi
if docker ps -a --format '{{.Names}}' | grep -qx "$BACKEND_NAME"; then
  echo "Remove existing container: docker rm -f $BACKEND_NAME" >&2
  exit 1
fi
if docker ps -a --format '{{.Names}}' | grep -qx "$FRONTEND_NAME"; then
  echo "Remove existing container: docker rm -f $FRONTEND_NAME" >&2
  exit 1
fi

echo "Starting MongoDB (data in volume ${MONGO_VOLUME})…"
docker volume create "$MONGO_VOLUME" >/dev/null 2>&1 || true
docker run -d \
  --name "$MONGO_NAME" \
  --network "$NETWORK" \
  -v "$MONGO_VOLUME:/data/db" \
  mongo:7

echo "Waiting for MongoDB to accept connections…"
for _ in $(seq 1 30); do
  if docker exec "$MONGO_NAME" mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 1
done

echo "Starting backend…"
docker run -d \
  --name "$BACKEND_NAME" \
  --network "$NETWORK" \
  -p 3001:3001 \
  -e PORT=3001 \
  -e MONGO_URI="$MONGO_URI" \
  "$BACKEND_IMAGE"

echo "Starting frontend (nginx on host port 3000)…"
docker run -d \
  --name "$FRONTEND_NAME" \
  --network "$NETWORK" \
  -p 3000:80 \
  "$FRONTEND_IMAGE"

echo "Done."
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  MongoDB:  only on Docker network ${NETWORK} (container ${MONGO_NAME}, volume ${MONGO_VOLUME})"
echo "Stop and remove: scripts/docker-down.sh (add --remove-volume to delete DB data)"
