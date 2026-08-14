#!/usr/bin/env bash
#
# Interactive local setup for the optional Google Export verification path.
#
# The wizard library below is shared with the repository's other setup wizards.

set -euo pipefail

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

TOTAL_STAGES=0
TOTAL_MINUTES=0
_STAGE_INDEX=0
_MINUTES_ELAPSED=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()
WRITTEN_SECRET=()
SKIPPED=()

_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages · about %s minutes%s\n\n' "$DIM" "$TOTAL_STAGES" "$TOTAL_MINUTES" "$RESET"
  printf '%s  You drive the browser; this wizard gives exact navigation steps and\n' "$DIM"
  printf '  captures the values you copy back. Stop with Ctrl-C and re-run later —\n'
  printf '  saved values are offered as defaults.%s\n' "$RESET"
  pause "Ready to start?"
}

stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  local remaining=$((TOTAL_MINUTES - _MINUTES_ELAPSED))
  (( remaining < 0 )) && remaining=0
  _MINUTES_ELAPSED=$((_MINUTES_ELAPSED + ${2:-0}))
  printf '\n%s%s▸ Stage %s/%s · %s%s  %s(~%s min left)%s\n' "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET" "$DIM" "$remaining" "$RESET"
}

say() { printf '  %s\n' "$1"; }
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

open_url() {
  local url="$1"
  printf '  %s↗ open%s %s\n' "$GREEN" "$RESET" "$url"
  [[ "${DOCGEN_SETUP_SKIP_OPEN:-0}" == "1" ]] && return 0
  { if command -v wslview >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser — visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser — visit it manually: $url"
}

pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line
  line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"; fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"; fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} )) && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES — each stage is one human action in the Google Cloud Console.
# ──────────────────────────────────────────────────────────────────────────

if [[ ! -f .env.example || ! -d .git ]]; then
  printf 'Run this wizard from the DocGen repository root.\n' >&2
  exit 1
fi

TOTAL_STAGES=4
TOTAL_MINUTES=10

banner "DocGen Google Export setup"

stage "Google Cloud project and APIs" 3
say "Google Export is optional; this setup is only needed for real credentialed verification."
open_url "https://console.cloud.google.com/projectselector/home/dashboard"
step "Create or select a project, then open APIs & Services → Library and enable Google Docs API."
step "Open APIs & Services → OAuth consent screen, choose External if needed, complete the app information, and add your Google account as a test user."
pause "When the project, Docs API, consent screen, and test user are ready, press Enter."

stage "OAuth client and redirect URIs" 3
open_url "https://console.cloud.google.com/apis/credentials"
step "Open Create credentials → OAuth client ID, choose Web application, and copy the client ID and client secret."
step "Under Authorized redirect URIs, add both exact values shown below:"
note "  API callback:    http://localhost:3000/api/auth/google/callback"
note "  OAuth verifier:  http://localhost:3001/oauth/callback"
step "Use only the documented scopes: https://www.googleapis.com/auth/documents and https://www.googleapis.com/auth/drive.file. Do not grant broad Drive access."
pause "After saving the OAuth client and redirect URIs, press Enter."

stage "Local environment values" 3
say "Enter public local URLs normally; secret values are hidden and never printed. Enter keeps an existing value."
ask PORT "API port (default 3000):"
[[ -z "$PORT" ]] && PORT=3000
ask GOOGLE_CLIENT_ID "Google OAuth client ID:"
ask_secret GOOGLE_CLIENT_SECRET "Google OAuth client secret:"
ask GOOGLE_REDIRECT_URI "API redirect URI (default http://localhost:3000/api/auth/google/callback):"
[[ -z "$GOOGLE_REDIRECT_URI" ]] && GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
ask GOOGLE_VERIFY_REDIRECT_URI "Verification redirect URI (default http://localhost:3001/oauth/callback):"
[[ -z "$GOOGLE_VERIFY_REDIRECT_URI" ]] && GOOGLE_VERIFY_REDIRECT_URI=http://localhost:3001/oauth/callback
ask WEB_ORIGIN "Web origin (default http://localhost:5173):"
[[ -z "$WEB_ORIGIN" ]] && WEB_ORIGIN=http://localhost:5173
write_env PORT "$PORT"
write_env GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
write_env GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
write_env GOOGLE_REDIRECT_URI "$GOOGLE_REDIRECT_URI"
write_env GOOGLE_VERIFY_REDIRECT_URI "$GOOGLE_VERIFY_REDIRECT_URI"
write_env WEB_ORIGIN "$WEB_ORIGIN"

stage "Optional provider verification token" 1
say "A short-lived GOOGLE_ACCESS_TOKEN is optional and is only used by the provider-only verification command."
say "Leave it empty to use the browser OAuth verification flow instead."
ask_secret GOOGLE_ACCESS_TOKEN "Optional access token (Enter to leave unchanged/empty):"
write_env GOOGLE_ACCESS_TOKEN "$GOOGLE_ACCESS_TOKEN"
pause "Press Enter to finish."

finish
printf 'Next commands:\n'
printf '  bun run dev\n'
printf '  bun run verify:google       # requires GOOGLE_ACCESS_TOKEN\n'
printf '  bun run verify:google:oauth # uses the OAuth browser flow\n'
