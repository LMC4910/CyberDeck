#!/usr/bin/env bash
# CyberDeck — macOS uninstaller (P1-AC-15). macOS .pkg has no native uninstall, so
# this script unregisters the launchd LaunchAgent and removes the install tree.
# Run as the user who installed CyberDeck (it removes their per-user LaunchAgent),
# with sudo for the /usr/local tree:
#   sudo installers/macos/scripts/uninstall.sh
set -euo pipefail

ENGINE="/usr/local/cyberdeck/cyberdeck"
TARGET_USER="${SUDO_USER:-$USER}"

# Unregister the launchd LaunchAgent via the engine's own uninstaller (as the user).
if [[ -x "$ENGINE" && -n "$TARGET_USER" && "$TARGET_USER" != "root" ]]; then
  /usr/bin/sudo -u "$TARGET_USER" "$ENGINE" --service uninstall || \
    echo "warning: launchd unregister failed (was it installed?)." >&2
fi

# Remove the install tree and the optional client app.
rm -rf /usr/local/cyberdeck
rm -rf /Applications/CyberDeck.app

# Forget the package receipt so a reinstall is clean.
pkgutil --forget io.cyberdeck.engine 2>/dev/null || true

echo "CyberDeck removed. Per-user data (~/Library/Application Support/CyberDeck) was"
echo "left in place — delete it manually for a full wipe."
