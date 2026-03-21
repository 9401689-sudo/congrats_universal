#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

git pull --ff-only origin main
docker compose -f deploy/docker-compose.server.yml up -d --build
