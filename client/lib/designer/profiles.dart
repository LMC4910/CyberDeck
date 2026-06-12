/// Profile management for the Designer (PROJ-216, 2C §2.2 / ADR-0017). A *profile*
/// is a named layout authored for one [DeviceClass]: the same physical deck can have
/// several profiles (e.g. "Streaming" on the 10" tablet, "Coding" on the phone), and
/// exactly one profile is *active* per device class at a time. The Designer ALWAYS
/// authors against an explicit target device class — there is no "ambient" target —
/// so "what you design is what that device shows" (the target is a UI invariant,
/// surfaced by [ProfileManager.targetClass] / [activeProfile] and asserted by tests).
library;

import 'package:flutter/foundation.dart';

import 'device_class.dart';

/// A named layout authored for a specific device class.
@immutable
class Profile {
  const Profile({
    required this.id,
    required this.name,
    required this.deviceClassId,
  });

  /// Stable id (the doc id the engine op-log keys on).
  final String id;

  /// Human-facing name (shown in the Designer's profile picker).
  final String name;

  /// The device class this profile is authored for.
  final String deviceClassId;

  Profile copyWith({String? name, String? deviceClassId}) => Profile(
        id: id,
        name: name ?? this.name,
        deviceClassId: deviceClassId ?? this.deviceClassId,
      );
}

/// Manages the set of profiles, which device class each targets, and which profile
/// is active per device class. Notifies listeners on any change so the Designer
/// chrome (target-device label, profile picker) repaints. Pure in-memory state —
/// persistence/broadcast is layered above (the engine owns the authoritative set).
class ProfileManager extends ChangeNotifier {
  ProfileManager({
    List<DeviceClass> deviceClasses = DeviceClass.presets,
    Iterable<Profile> initial = const [],
  }) : deviceClasses = List.unmodifiable(deviceClasses) {
    for (final p in initial) {
      _profiles[p.id] = p;
    }
  }

  /// The device classes a profile may target.
  final List<DeviceClass> deviceClasses;

  final Map<String, Profile> _profiles = {};

  /// active[deviceClassId] = the id of the active profile for that class.
  final Map<String, String> _active = {};

  /// The id of the profile currently open in the Designer (the edit target).
  String? _editing;

  /// All profiles, in insertion order.
  List<Profile> get profiles => List.unmodifiable(_profiles.values);

  /// Profiles authored for a given device class.
  List<Profile> profilesFor(String deviceClassId) =>
      [for (final p in _profiles.values) if (p.deviceClassId == deviceClassId) p];

  /// Looks a profile up by id (or null).
  Profile? profile(String id) => _profiles[id];

  /// The device class for [deviceClassId], falling back to the default class so the
  /// Designer ALWAYS has a concrete target to display (never null — the invariant).
  DeviceClass deviceClass(String deviceClassId) => deviceClasses.firstWhere(
        (d) => d.id == deviceClassId,
        orElse: () => DeviceClass.defaultClass,
      );

  /// The profile currently being edited (null before one is opened).
  Profile? get editingProfile => _editing == null ? null : _profiles[_editing];

  /// The device class the Designer is currently authoring against — the explicit
  /// target. Always concrete; defaults to [DeviceClass.defaultClass] when nothing is
  /// open, so the canvas can always state its target device.
  DeviceClass get targetClass {
    final p = editingProfile;
    return p == null ? DeviceClass.defaultClass : deviceClass(p.deviceClassId);
  }

  /// The active profile for a device class (or null if none assigned).
  Profile? activeProfile(String deviceClassId) {
    final id = _active[deviceClassId];
    return id == null ? null : _profiles[id];
  }

  /// Creates a new profile for [deviceClassId]. If it is the first profile for that
  /// class it becomes active automatically (a class with profiles always has one
  /// active). Returns the created profile.
  Profile create({
    required String id,
    required String name,
    required String deviceClassId,
  }) {
    if (_profiles.containsKey(id)) {
      throw ArgumentError('profile id already exists: $id');
    }
    final p = Profile(id: id, name: name, deviceClassId: deviceClassId);
    _profiles[id] = p;
    _active.putIfAbsent(deviceClassId, () => id);
    notifyListeners();
    return p;
  }

  /// Re-assigns a profile to a different device class (re-authoring it for another
  /// device). Fixes up active assignments on both the old and new class.
  void assign(String profileId, String deviceClassId) {
    final p = _profiles[profileId];
    if (p == null) throw ArgumentError('unknown profile: $profileId');
    if (p.deviceClassId == deviceClassId) return;
    final oldClass = p.deviceClassId;
    _profiles[profileId] = p.copyWith(deviceClassId: deviceClassId);

    // If it was active on the old class, pick another there (or clear it).
    if (_active[oldClass] == profileId) {
      final remaining = profilesFor(oldClass);
      if (remaining.isEmpty) {
        _active.remove(oldClass);
      } else {
        _active[oldClass] = remaining.first.id;
      }
    }
    // New class adopts it as active if it has none.
    _active.putIfAbsent(deviceClassId, () => profileId);
    notifyListeners();
  }

  /// Activates [profileId] for its device class (exactly one active per class).
  void activate(String profileId) {
    final p = _profiles[profileId];
    if (p == null) throw ArgumentError('unknown profile: $profileId');
    _active[p.deviceClassId] = profileId;
    notifyListeners();
  }

  /// Opens a profile for editing in the Designer (sets the explicit target). The
  /// target device class is then [targetClass].
  void edit(String profileId) {
    if (!_profiles.containsKey(profileId)) {
      throw ArgumentError('unknown profile: $profileId');
    }
    _editing = profileId;
    notifyListeners();
  }

  /// Whether [profileId] is the active profile for its device class.
  bool isActive(String profileId) {
    final p = _profiles[profileId];
    return p != null && _active[p.deviceClassId] == profileId;
  }
}
