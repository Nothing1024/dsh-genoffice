#!/bin/sh
# Install profile `go` under this directory (this folder is DSH_HOME).
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
PLUGIN=$(CDPATH='' cd -- "$ROOT/.." && pwd)
GO="$ROOT/profiles/go"

if [ ! -d "$PLUGIN/packages/tab-genoffice/lib" ]; then
  echo "env/setup: build the plugin first: (cd $PLUGIN && pnpm run build)" >&2
  exit 1
fi

cd "$GO"
pnpm install
echo "env/setup: ok"
echo "boot: $ROOT/boot.sh"
echo "or:   DSH_HOME=$ROOT npx --yes @deepseek-ai/dsh@0.1.2-rc.1 --profile go --port 3080"
