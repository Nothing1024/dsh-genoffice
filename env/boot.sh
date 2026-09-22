#!/bin/sh
# Boot profile `go` from this env directory.
#   sh env/boot.sh              :3082 (LAN bind comes from dsh-web-lan-access)
set -eu
# Prefer NVM's default Node. OMP PATH lists Homebrew /usr/local/bin first,
# and that Node's OpenSSL CA store is empty (LLM TLS Connection error).
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
_nvm_alias=$(tr -d '[:space:]' < "$NVM_DIR/alias/default" 2>/dev/null || true)
_nvm_root=$(ls -1d "$NVM_DIR/versions/node"/v${_nvm_alias#v}* 2>/dev/null | tail -1 || true)
if [ -n "${_nvm_root:-}" ] && [ -x "$_nvm_root/bin/node" ]; then
  PATH="$_nvm_root/bin:$PATH"
  export PATH
fi
unset _nvm_alias _nvm_root

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ ! -d "$ROOT/profiles/go/node_modules/@deepseek-ai/dsh-base" ]; then
  echo "env/boot: run $ROOT/setup.sh first" >&2
  exit 1
fi
export DSH_HOME="$ROOT"
export DSH_GENOFFICE_ROOT="$(CDPATH='' cd -- "$ROOT/.." && pwd)"
# Preview iframe hits http://localhost:8787. If the forked engine is down, the
# GenOffice tab is a white page. start-relay is a no-op when already healthy.
if [ -f "$DSH_GENOFFICE_ROOT/scripts/dev.mjs" ]; then
  node "$DSH_GENOFFICE_ROOT/scripts/dev.mjs" start-relay || true
fi
exec "$ROOT/profiles/go/node_modules/.bin/dsh" --profile go --port 3082 "$@"
