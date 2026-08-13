#!/usr/bin/env bash

set -euo pipefail

canonical='carsonSgit <carsonSgit@users.noreply.github.com>'
ref="${1:-HEAD}"

unexpected="$({ git log "$ref" --format='%aN <%aE>|%cN <%cE>' | tr '|' '\n' | sort -u; } | awk -v expected="$canonical" '$0 != expected && $0 != ""')"

if [[ -n "$unexpected" ]]; then
  printf 'Unexpected author or committer identity in %s:\n%s\n' "$ref" "$unexpected" >&2
  exit 1
fi

printf 'History identities in %s are canonical.\n' "$ref"
