#!/bin/sh
# CyberDeck .deb/.rpm postinstall — register + start the systemd service so the
# engine stays reachable after the UI closes (P1-AC-01). Runs as root.
#
# Delegates to the engine's own installer so the unit definition stays single-
# sourced (engine/internal/service/linux.go writes /etc/systemd/system/cyberdeck.service,
# daemon-reloads, and `enable --now`s it).
set -e

ENGINE="/opt/cyberdeck/cyberdeck"

if [ -x "$ENGINE" ]; then
  "$ENGINE" --service install || \
    echo "warning: systemd registration failed; run '$ENGINE --service install' manually." >&2
fi

exit 0
