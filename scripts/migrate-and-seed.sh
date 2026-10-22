#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
compose_env_file="${COMPOSE_ENV_FILE:-.env}"
if [ ! -f "$compose_env_file" ]; then
  echo 'Run npm run dev to initialize .env, or create your configured environment file first.' >&2
  exit 1
fi

docker compose --env-file "$compose_env_file" run --build --rm backend npm run db:prepare
