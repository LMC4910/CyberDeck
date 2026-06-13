/// Shared icon-name → [IconData] resolver for the Wave 1 rich widgets
/// (launcher / metric.tile / status.list). Layout authors name an icon as a
/// plain string in `style`/`config`; this maps the CyberDeck vocabulary to
/// Material glyphs with a safe default, so a missing/unknown name never crashes.
library;

import 'package:flutter/material.dart';

/// Resolves a deck icon [name] to an [IconData], falling back to [fallback].
IconData deckIcon(String? name, {IconData fallback = Icons.widgets_outlined}) {
  switch (name) {
    case 'play':
      return Icons.play_arrow;
    case 'pause':
      return Icons.pause;
    case 'next':
      return Icons.skip_next;
    case 'previous':
      return Icons.skip_previous;
    case 'shuffle':
      return Icons.shuffle;
    case 'repeat':
      return Icons.repeat;
    case 'power':
      return Icons.power_settings_new;
    case 'volume':
      return Icons.volume_up;
    case 'mute':
      return Icons.volume_off;
    case 'mic':
      return Icons.mic_none;
    case 'alert':
      return Icons.warning_amber;
    case 'cpu':
      return Icons.memory;
    case 'gpu':
      return Icons.developer_board;
    case 'ram':
    case 'memory':
      return Icons.sd_storage_outlined;
    case 'disk':
    case 'storage':
      return Icons.storage;
    case 'temp':
    case 'thermometer':
      return Icons.thermostat;
    case 'network':
    case 'wifi':
      return Icons.wifi;
    case 'download':
      return Icons.download;
    case 'upload':
      return Icons.upload;
    case 'battery':
      return Icons.battery_full;
    case 'bolt':
    case 'power-draw':
      return Icons.bolt;
    case 'fan':
      return Icons.mode_fan_off;
    case 'clock':
    case 'time':
      return Icons.schedule;
    case 'app':
    case 'launch':
      return Icons.rocket_launch_outlined;
    case 'terminal':
      return Icons.terminal;
    case 'browser':
      return Icons.public;
    case 'folder':
      return Icons.folder_outlined;
    case 'game':
      return Icons.sports_esports_outlined;
    case 'camera':
      return Icons.videocam_outlined;
    case 'light':
    case 'bulb':
      return Icons.lightbulb_outline;
    case 'home':
      return Icons.home_outlined;
    case 'settings':
      return Icons.settings_outlined;
    case 'star':
      return Icons.star_outline;
    case 'check':
      return Icons.check_circle_outline;
    case 'error':
      return Icons.error_outline;
    case 'warn':
      return Icons.warning_amber_outlined;
    case 'info':
      return Icons.info_outline;
    default:
      return fallback;
  }
}
