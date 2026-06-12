#!/usr/bin/env bash
# CyberDeck — build Linux .deb + .rpm packages with nfpm.
#
# Run ON Linux (or any host with nfpm) after `task dist:linux`:
#   installers/linux/build-packages.sh [VERSION]
#
# Requires nfpm: https://nfpm.goreleaser.com/install/
#   go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
set -euo pipefail

VERSION="${1:-0.0.0-dev}"
export VERSION

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/Output"

if [[ ! -x "$REPO_ROOT/dist/linux/cyberdeck" ]]; then
  echo "error: dist/linux/cyberdeck not found — run 'task dist:linux' first." >&2
  exit 1
fi
if ! command -v nfpm >/dev/null 2>&1; then
  echo "error: nfpm not installed (go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest)." >&2
  exit 1
fi

mkdir -p "$OUT"
nfpm package -f "$HERE/nfpm.yaml" -p deb -t "$OUT/"
nfpm package -f "$HERE/nfpm.yaml" -p rpm -t "$OUT/"

echo "Built packages in $OUT:"
ls -1 "$OUT"/*.deb "$OUT"/*.rpm 2>/dev/null || true
