#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export SKYEQUANTA_BOOT_PROFILE="${SKYEQUANTA_BOOT_PROFILE:-devcontainer}"
export SKYEQUANTA_DEV="${SKYEQUANTA_DEV:-1}"
export SKYEQUANTA_AUTO_INSTALL_SYSTEM_DEPS="${SKYEQUANTA_AUTO_INSTALL_SYSTEM_DEPS:-1}"
cd "$ROOT_DIR"
node apps/skyequanta-shell/bin/cold-machine-bootstrap.mjs --profile "$SKYEQUANTA_BOOT_PROFILE" "$@"
