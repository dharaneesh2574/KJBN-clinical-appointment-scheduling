#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
compose_env_file="${COMPOSE_ENV_FILE:-.env}"
if [ ! -f "$compose_env_file" ]; then
  echo 'Copy .env.example to .env and configure local Compose settings first.' >&2
  exit 1
fi

docker compose --env-file "$compose_env_file" run --rm migrate
docker compose --env-file "$compose_env_file" --profile tools run --rm --no-deps seed
