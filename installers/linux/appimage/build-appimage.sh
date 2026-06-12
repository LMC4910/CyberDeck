#!/usr/bin/env bash
# CyberDeck — build a portable Linux AppImage.
#
# Run ON Linux after `task dist:linux`, with appimagetool on PATH:
#   https://github.com/AppImage/appimagetool/releases
#   installers/linux/appimage/build-appimage.sh [VERSION]
#
# Produces installers/linux/Output/CyberDeck-<version>-x86_64.AppImage — a single
# portable file that runs the engine with no install (AppRun launches --console and
# points the engine at the bundled plugins).
set -euo pipefail

VERSION="${1:-0.0.0-dev}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
DIST="$REPO_ROOT/dist/linux"
APPDIR="$HERE/CyberDeck.AppDir"
OUT="$HERE/../Output"

if [[ ! -x "$DIST/cyberdeck" ]]; then
  echo "error: $DIST/cyberdeck not found — run 'task dist:linux' first." >&2
  exit 1
fi
if ! command -v appimagetool >/dev/null 2>&1; then
  echo "error: appimagetool not on PATH (https://github.com/AppImage/appimagetool/releases)." >&2
  exit 1
fi

rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$OUT"

# Payload: engine + plugins, preserving the layout the engine expects.
cp "$DIST/cyberdeck" "$APPDIR/usr/bin/cyberdeck"
cp -R "$DIST/plugins" "$APPDIR/usr/bin/plugins"
chmod +x "$APPDIR/usr/bin/cyberdeck"
find "$APPDIR/usr/bin/plugins" -type f -exec chmod +x {} +

# AppDir metadata.
cp "$HERE/AppRun" "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"
cp "$HERE/cyberdeck.desktop" "$APPDIR/cyberdeck.desktop"
cp "$HERE/cyberdeck.png" "$APPDIR/cyberdeck.png"

ARCH=x86_64 appimagetool "$APPDIR" "$OUT/CyberDeck-$VERSION-x86_64.AppImage"

echo "Built: $OUT/CyberDeck-$VERSION-x86_64.AppImage"
