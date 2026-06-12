#!/bin/sh
# CyberDeck .deb/.rpm postremove — belt-and-suspenders cleanup after files are
# removed (P1-AC-15). The unit is normally removed by the engine in preremove; this
# clears any stale unit file left behind (e.g. if the binary was already gone) and
# reloads systemd. Runs as root. Per-user data under ~/.config/CyberDeck is left in
# place intentionally.
set -e

UNIT="/etc/systemd/system/cyberdeck.service"

if [ -f "$UNIT" ]; then
  systemctl disable --now cyberdeck.service 2>/dev/null || true
  rm -f "$UNIT"
fi
systemctl daemon-reload 2>/dev/null || true

exit 0
