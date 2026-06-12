#!/usr/bin/env bash
# CyberDeck — macOS installer builder (.pkg).
#
# Packages the release bundle from `task dist:macos`:
#   dist/macos/cyberdeck
#   dist/macos/plugins/<name>/<name>   (telemetry, power, volume, launchers, notifications)
# (+ the Flutter macOS .app when built natively — see notes below)
#
# into a flat component .pkg that installs the engine + plugins under
#   /usr/local/cyberdeck/
# and registers the engine as a per-user launchd LaunchAgent (P1-AC-01) via the
# postinstall script, so the deck stays reachable after the UI closes.
# The pre-uninstall is provided as a separate script (macOS .pkg has no native
# uninstall); see scripts/uninstall.sh (P1-AC-15).
#
# This script must run ON macOS (pkgbuild/productbuild are macOS-only). It is
# documented-manual: not executed on the Windows CI host. See README.md.
#
# Usage (from repo root, after `task dist:macos`):
#   installers/macos/build-pkg.sh [VERSION]
# Env overrides for signing/notarization (see notarize.sh / README.md):
#   SIGN_IDENTITY      "Developer ID Installer: Your Name (TEAMID)"  (optional; unsigned if empty)
set -euo pipefail

VERSION="${1:-0.0.0-dev}"
IDENTIFIER="io.cyberdeck.engine"
INSTALL_ROOT="/usr/local/cyberdeck"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
DIST="$REPO_ROOT/dist/macos"
BUILD="$HERE/build"
PKGROOT="$BUILD/root"
SCRIPTS="$BUILD/scripts"
OUT="$HERE/Output"

if [[ ! -x "$DIST/cyberdeck" ]]; then
  echo "error: $DIST/cyberdeck not found — run 'task dist:macos' first." >&2
  exit 1
fi

rm -rf "$BUILD" "$OUT"
mkdir -p "$PKGROOT$INSTALL_ROOT" "$SCRIPTS" "$OUT"

# --- payload: engine + plugins, preserving the layout the engine expects ---------
cp "$DIST/cyberdeck" "$PKGROOT$INSTALL_ROOT/cyberdeck"
cp -R "$DIST/plugins" "$PKGROOT$INSTALL_ROOT/plugins"
# Ship the uninstaller alongside the install so end users can remove cleanly.
cp "$HERE/scripts/uninstall.sh" "$PKGROOT$INSTALL_ROOT/uninstall.sh"
chmod -R u+rwX,go+rX "$PKGROOT$INSTALL_ROOT"
chmod +x "$PKGROOT$INSTALL_ROOT/cyberdeck" "$PKGROOT$INSTALL_ROOT/uninstall.sh"
find "$PKGROOT$INSTALL_ROOT/plugins" -type f -exec chmod +x {} +

# Optional: bundle the Flutter macOS .app if it was built natively.
if [[ -d "$DIST/CyberDeck.app" ]]; then
  mkdir -p "$PKGROOT/Applications"
  cp -R "$DIST/CyberDeck.app" "$PKGROOT/Applications/CyberDeck.app"
fi

# --- install scripts: register the launchd service on install --------------------
cp "$HERE/scripts/postinstall" "$SCRIPTS/postinstall"
chmod +x "$SCRIPTS/postinstall"

# --- build the component package -------------------------------------------------
COMPONENT_PKG="$BUILD/cyberdeck-component.pkg"
pkgbuild \
  --root "$PKGROOT" \
  --scripts "$SCRIPTS" \
  --identifier "$IDENTIFIER" \
  --version "$VERSION" \
  --install-location "/" \
  "$COMPONENT_PKG"

# --- wrap in a distribution product (for a friendlier installer UI) --------------
PRODUCT_PKG="$OUT/CyberDeck-$VERSION.pkg"
productbuild \
  --distribution "$HERE/distribution.xml" \
  --package-path "$BUILD" \
  --resources "$HERE/resources" \
  "$PRODUCT_PKG"

# --- optional: sign the installer (Developer ID Installer) -----------------------
if [[ -n "${SIGN_IDENTITY:-}" ]]; then
  echo "Signing $PRODUCT_PKG with: $SIGN_IDENTITY"
  productsign --sign "$SIGN_IDENTITY" "$PRODUCT_PKG" "$PRODUCT_PKG.signed"
  mv "$PRODUCT_PKG.signed" "$PRODUCT_PKG"
fi

echo "Built: $PRODUCT_PKG"
echo "Next (optional): installers/macos/notarize.sh \"$PRODUCT_PKG\""
