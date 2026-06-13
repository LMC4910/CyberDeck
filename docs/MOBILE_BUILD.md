# CyberDeck — Mobile build sequence (Android + iOS)

The Android and iOS apps are the **CyberDeck client only**. There is **no engine on
mobile** — the phone/tablet discovers and pairs with a **desktop engine over the LAN**
(QR pairing → encrypted session). So a mobile build is just the Flutter client; to use
it, run a CyberDeck engine on a PC on the same network (`task run:engine`, or install
a desktop build).

App identifiers: Android `com.shishir.cyberdeck_client` · iOS `com.shishir.cyberdeckClient`.
Version comes from `client/pubspec.yaml` (`version: 1.0.0+1` → `versionName 1.0.0`,
`versionCode 1`). Bump it there before a release build.

---

## Android — APK + AAB

**Prerequisites:** Flutter 3.44.1, JDK 17, Android SDK (cmdline-tools + platform +
build-tools). `flutter doctor --android-licenses` accepted.

### Sequence

1. **Fetch deps** (once / after pubspec changes):
   ```sh
   cd client && flutter pub get
   ```
2. **(Release only) configure signing.** Generate a keystore once and create
   `client/android/key.properties` (gitignored) from `key.properties.example`:
   ```sh
   keytool -genkey -v -keystore ~/cyberdeck-release.jks -keyalg RSA -keysize 2048 \
           -validity 10000 -alias cyberdeck
   cp client/android/key.properties.example client/android/key.properties   # then edit
   ```
   Without `key.properties` the release build **debug-signs** (it builds and runs, but
   is **not** distributable on the Play Store).
3. **Build** — one command via Task (APK for sideloading + AAB for the Play Store):
   ```sh
   task dist:android
   ```
   or the raw Flutter commands:
   ```sh
   cd client
   flutter build apk --release          # → build/app/outputs/flutter-apk/app-release.apk
   flutter build appbundle --release    # → build/app/outputs/bundle/release/app-release.aab
   ```
4. **Artifacts** (Task copies them out):
   ```
   dist/android/cyberdeck-client.apk    # sideload / direct install
   dist/android/cyberdeck-client.aab    # upload to Google Play
   ```
5. **Install on a device** (APK):
   ```sh
   adb install -r dist/android/cyberdeck-client.apk
   ```
6. **Run / pair:** launch the app, start a desktop engine (`task run:engine`), scan the
   pairing QR (camera permission), and the deck goes live.

> Per-ABI split (smaller APKs): add `--split-per-abi` to `flutter build apk`.

---

## iOS — IPA (macOS + Xcode only)

**Prerequisites:** a **Mac** with Xcode 15+, CocoaPods, Flutter 3.44.1, and (for a
distributable build) an **Apple Developer account** with a signing certificate +
provisioning profile. iOS **cannot** be built on Windows/Linux.

### Sequence

1. **Fetch deps + pods:**
   ```sh
   cd client && flutter pub get
   cd ios && pod install && cd ..
   ```
2. **Set the signing team** (once): open `client/ios/Runner.xcworkspace` in Xcode →
   *Runner → Signing & Capabilities* → select your Team and confirm the bundle id
   `com.shishir.cyberdeckClient` (or run with `--no-codesign` for a verification build).
3. **Verification build** (no certs needed — confirms it compiles):
   ```sh
   task dist:ios                         # → flutter build ios --release --no-codesign
   ```
4. **Distributable IPA** (signed) — create an `ExportOptions.plist` (method
   `app-store` / `ad-hoc` / `development`), then:
   ```sh
   cd client
   flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
   # → build/ios/ipa/*.ipa
   ```
   or via Task:
   ```sh
   IOS_EXPORT_OPTIONS=ios/ExportOptions.plist task dist:ios   # → dist/ios/*.ipa
   ```
5. **Distribute:** upload the `.ipa` to **TestFlight / App Store** with Transporter or
   `xcrun altool`/`notarytool`, or install an ad-hoc/development build on a registered
   device.
6. **Run / pair:** launch on the device, start a desktop engine on the same Wi‑Fi,
   scan the pairing QR.

> Quick on-device dev run (no IPA): `flutter run --release -d <device>` from `client/`.

---

## CI

`.github/workflows/mobile.yml` (manual `workflow_dispatch` or on `v*` tags):

- **android** job (ubuntu): builds APK + AAB via `task dist:android`, uploads the
  `cyberdeck-android` artifact. Signs with a release keystore when these repo secrets
  exist (else debug-signs): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (base64-encode the `.jks` for the first).
- **ios** job (macos): unsigned verification build via `task dist:ios`. For a signed
  IPA, import certs (e.g. `apple-actions/import-codesign-certs`) and set
  `IOS_EXPORT_OPTIONS` so `task dist:ios` emits `dist/ios/*.ipa`.

---

## Relationship to the desktop installers

Desktop (Windows/macOS/Linux) ships **one combined installer** that bundles the engine
+ the desktop client (see `installers/`). Mobile is intentionally separate: the
engine is a desktop daemon and **cannot run on Android/iOS**, so these apps are remote
clients that connect to a desktop engine over the LAN.
