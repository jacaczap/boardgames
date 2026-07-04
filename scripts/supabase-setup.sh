#!/usr/bin/env bash
# =============================================================================
# Supabase backend deploy (IaC)
# =============================================================================
# Targets ONE environment (dev or prod): link, push migrations (schema + grants
# + RLS + cron), deploy edge functions, and print the pg_cron Vault secret SQL.
# One-time/guided steps (creating a project, copying keys) live in
# docs/supabase-dev-setup.md.
#
# Config is read from env vars and from a gitignored `.env.<env>` at the repo
# root if present (copy from .env.example):
#   EXPO_PUBLIC_SUPABASE_URL  (required)  https://<ref>.supabase.co — the project
#                                         ref (for link) is derived from its subdomain
#   <DEV|PROD>_SECRET_KEY     (Vault SQL) sb_secret_…
#
# Usage: scripts/supabase-setup.sh <dev|prod> [all|link|db|functions|secrets]
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENVIRONMENT="${1:-}"
case "$ENVIRONMENT" in
  dev|prod) ;;
  *) echo "Usage: $0 <dev|prod> [all|link|db|functions|secrets]" >&2; exit 1 ;;
esac
cmd="${2:-all}"

ENV_FILE=".env.$ENVIRONMENT"
# shellcheck disable=SC1090
if [ -f "$ENV_FILE" ]; then set -a; source "$ENV_FILE"; set +a; fi

PREFIX="$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')_"
key_var="${PREFIX}SECRET_KEY";  SECRET_KEY="${!key_var:-}"

# The project URL is the app runtime var; the project ref is its subdomain.
PROJECT_URL="${EXPO_PUBLIC_SUPABASE_URL:-}"
PROJECT_REF="${PROJECT_URL#*://}"; PROJECT_REF="${PROJECT_REF%%.*}"

SUPABASE="npx --no-install supabase"

ensure_config() {
  [ -f supabase/config.toml ] || {
    echo "==> Creating supabase/config.toml from example"
    cp supabase/config.toml.example supabase/config.toml
  }
}

do_link() {
  : "${PROJECT_REF:?Set EXPO_PUBLIC_SUPABASE_URL in $ENV_FILE or the environment}"
  ensure_config
  echo "==> [$ENVIRONMENT] Linking to project $PROJECT_REF"
  $SUPABASE link --project-ref "$PROJECT_REF"
}

# Guard against pushing/deploying to the wrong project: link if the CLI's
# currently-linked ref doesn't match this environment's ref.
ensure_linked() {
  : "${PROJECT_REF:?Set EXPO_PUBLIC_SUPABASE_URL in $ENV_FILE or the environment}"
  local current=""
  [ -f supabase/.temp/project-ref ] && current="$(<supabase/.temp/project-ref)"
  [ "$current" = "$PROJECT_REF" ] || do_link
}

do_db() {
  ensure_linked
  echo "==> [$ENVIRONMENT] Pushing migrations (schema, grants, RLS, cron)"
  $SUPABASE db push
}

do_functions() {
  ensure_linked
  echo "==> [$ENVIRONMENT] Deploying edge functions (verify_jwt from config.toml)"
  $SUPABASE functions deploy
}

do_secrets() {
  local url="${PROJECT_URL:-<EXPO_PUBLIC_SUPABASE_URL>}"
  local key="${SECRET_KEY:-<${PREFIX}SECRET_KEY>}"
  cat <<MSG
==> [$ENVIRONMENT] pg_cron Vault secrets — run ONCE in this project's SQL editor
    (Dashboard → SQL editor). pg_cron can't invoke edge functions until they exist:

select vault.create_secret('${url}', 'project_url');
select vault.create_secret('${key}', 'service_role_key');
MSG
}

case "$cmd" in
  link)      do_link ;;
  db)        do_db ;;
  functions) do_functions ;;
  secrets)   do_secrets ;;
  all)       do_link; do_db; do_functions; do_secrets ;;
  *) echo "Unknown command: $cmd (use: all|link|db|functions|secrets)" >&2; exit 1 ;;
esac

echo "==> [$ENVIRONMENT] Done ($cmd)."
