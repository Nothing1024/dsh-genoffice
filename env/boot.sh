#!/bin/sh
# Boot profile `go` from this env directory (loopback only).
#   sh env/boot.sh              loopback :3080 (matches bundle webUrl)
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ ! -d "$ROOT/profiles/go/node_modules/@deepseek-ai/dsh-base" ]; then
  echo "env/boot: run $ROOT/setup.sh first" >&2
  exit 1
fi
export DSH_HOME="$ROOT"
export DSH_GENOFFICE_ROOT="$(CDPATH='' cd -- "$ROOT/.." && pwd)"
exec npx --yes @deepseek-ai/dsh@0.1.0-rc.7 --profile go --port 3080 "$@"
