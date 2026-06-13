#!/usr/bin/env bash
# CyberDeck — build a portable Linux AppImage.
#
# Run ON Linux after `task dist:linux`, with appimagetool on PATH:
#   https://github.com/AppImage/appimagetool/releases
#   installers/linux/appimage/build-appimage.sh [VERSION]
#
# Produces installers/linux/Output/CyberDeck-<version>-x86_64.AppImage — a single
# portable file containing BOTH the engine + plugins AND the Flutter desktop client.
# AppRun starts the engine in the background then launches the client, so there is
# no way to end up with the client but no engine.
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
# The AppImage MUST contain BOTH the engine and the desktop client — never one
# without the other. dist:client:linux stages the Flutter bundle under dist/linux/client/.
if [[ ! -x "$DIST/client/cyberdeck_client" ]]; then
  echo "error: $DIST/client/cyberdeck_client not found — run 'task dist:linux' on Linux (it builds the client) before packaging. The AppImage must bundle engine + client together." >&2
  exit 1
fi
if ! command -v appimagetool >/dev/null 2>&1; then
  echo "error: appimagetool not on PATH (https://github.com/AppImage/appimagetool/releases)." >&2
  exit 1
fi

rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$OUT"

# Payload: engine + plugins + the Flutter desktop client, preserving the layout the
# engine expects (plugins next to the engine) and the client's bundle layout.
cp "$DIST/cyberdeck" "$APPDIR/usr/bin/cyberdeck"
cp -R "$DIST/plugins" "$APPDIR/usr/bin/plugins"
cp -R "$DIST/client" "$APPDIR/usr/bin/client"
chmod +x "$APPDIR/usr/bin/cyberdeck" "$APPDIR/usr/bin/client/cyberdeck_client"
find "$APPDIR/usr/bin/plugins" -type f -exec chmod +x {} +

# AppDir metadata.
cp "$HERE/AppRun" "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"
cp "$HERE/cyberdeck.desktop" "$APPDIR/cyberdeck.desktop"
cp "$HERE/cyberdeck.png" "$APPDIR/cyberdeck.png"

ARCH=x86_64 appimagetool "$APPDIR" "$OUT/CyberDeck-$VERSION-x86_64.AppImage"

echo "Built: $OUT/CyberDeck-$VERSION-x86_64.AppImage"
