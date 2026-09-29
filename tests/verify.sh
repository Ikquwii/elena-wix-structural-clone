#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
RUNTIME=/Users/sibas/.cache/codex-runtimes/codex-primary-runtime/dependencies
NODE=$(command -v node || true)
PYTHON="$RUNTIME/python/bin/python3"
if [ -z "$NODE" ]; then NODE="$RUNTIME/node/bin/node"; fi
if [ ! -x "$PYTHON" ]; then PYTHON=$(command -v python3); fi
"$NODE" --check "$ROOT/app.js"
"$NODE" --check "$ROOT/gallery-data.js"
"$PYTHON" "$ROOT/tests/verify.py"
