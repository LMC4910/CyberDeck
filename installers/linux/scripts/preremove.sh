#!/bin/sh
# CyberDeck .deb/.rpm preremove — stop + remove the systemd unit BEFORE the files
# are deleted, so uninstall is clean (P1-AC-15). Runs as root.
#
# Guard on the binary still existing (it does at preremove time) and delegate to the
# engine's own uninstaller (engine/internal/service/linux.go: disable --now +
# remove unit + daemon-reload).
set -e

ENGINE="/opt/cyberdeck/cyberdeck"

if [ -x "$ENGINE" ]; then
  "$ENGINE" --service uninstall || \
    echo "warning: systemd unregister failed (continuing removal)." >&2
fi

exit 0
