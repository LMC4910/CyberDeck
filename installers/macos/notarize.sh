#!/usr/bin/env bash
# CyberDeck — macOS notarization (documented-manual; run on a Mac with Xcode tools).
#
# Submits a signed .pkg to Apple's notary service and staples the ticket so the
# installer runs on other Macs without Gatekeeper warnings.
#
# Prerequisites:
#   * The .pkg must already be signed with a "Developer ID Installer" cert
#     (SIGN_IDENTITY in build-pkg.sh), and the engine/plugin binaries inside should
#     be signed + hardened-runtime with a "Developer ID Application" cert.
#   * A notarytool credential profile stored once via:
#       xcrun notarytool store-credentials cyberdeck-notary \
#         --apple-id "you@example.com" --team-id "TEAMID" --password "<app-specific-pwd>"
#
# Usage:
#   installers/macos/notarize.sh Output/CyberDeck-1.0.0.pkg [PROFILE]
set -euo pipefail

PKG="${1:?usage: notarize.sh <pkg> [keychain-profile]}"
PROFILE="${2:-cyberdeck-notary}"

echo "Submitting $PKG to Apple notary (profile: $PROFILE)..."
xcrun notarytool submit "$PKG" --keychain-profile "$PROFILE" --wait

echo "Stapling the notarization ticket..."
xcrun stapler staple "$PKG"

echo "Verifying..."
xcrun stapler validate "$PKG"
spctl --assess --type install --verbose=4 "$PKG" || true

echo "Notarized + stapled: $PKG"
