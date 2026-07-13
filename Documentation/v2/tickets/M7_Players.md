# M7 — Players (CD-701…715)

**Gate:** a deck authored in the IDE renders on **Android + iOS + Windows player** with parity to Player Preview · tap→action round-trip < 100 ms p95 LAN · wifi-kill self-heals without re-pairing · `client/designer/` deleted.
**Entry:** CD-619 passed (CD-512 layout push already live). **Exit:** CD-715 recorded.
**Hardware:** iOS tickets (CD-711…713) require the Mac (A4). If absent, execute CD-701…710 + CD-714, record the iOS deferral at CD-715, and proceed — Android/desktop GA is not blocked.

## Board

- [ ] CD-701 Player shell refocus
- [ ] CD-702 Layout v2 parser → render model
- [ ] CD-703 Renderer: pages, instances, per-device
- [ ] CD-704 Parity harness (player vs preview)
- [ ] CD-705 Delete `client/designer/`
- [ ] CD-706 Manifest-driven widget registry adapter
- [ ] CD-707 GA gap widgets (player side)
- [ ] CD-708 Interaction verbs + haptics + latency probe
- [ ] CD-709 Offline layout cache + reconnect UX
- [ ] CD-710 Pairing UX v2
- [ ] CD-711 iOS build + entitlements (Mac)
- [ ] CD-712 iOS quirks + local-network permission (Mac)
- [ ] CD-713 TestFlight distribution (Mac)
- [ ] CD-714 Android release build + Windows player build
- [ ] CD-715 **M7 gate review**

---

### CD-701 · Player shell refocus
**BP:** PLY-E01 · **Hat:** MOB · **P:** P0 · **Est:** M · **Deps:** CD-619
**Do:** Remove designer entry points from the player UX (code deleted at CD-705); player navigation (deck pages, settings, connection status); demo mode kept; existing 34 tests stay green.
**AC:**
- [ ] no edit affordances remain; demo + live modes both launch
- [ ] `flutter analyze` + full test suite green

### CD-702 · Layout v2 parser → render model
**BP:** PLY-E02-T01 · **Hat:** MOB · **P:** P0 · **Est:** M · **Deps:** CD-701
**Do:** Parse `cyberdeck.layout` (Dart types generated from the schema — extends `task gen:types`) into the render model; doc-version guard (newer doc → friendly "update engine/app" state, never crash).
**AC:**
- [ ] CD-416 golden fixtures parse to expected models (shared vectors)
- [ ] Dart typegen wired into the drift gate

### CD-703 · Renderer: pages, instances, per-device
**BP:** PLY-E02-T02 · **Hat:** MOB · **P:** P0 · **Est:** L · **Deps:** CD-702
**Do:** Extend `lib/render/` interpreter: multi-page navigation, flattened component instances, per-device assignment handling, binding-fed live values via the existing state store; degradation rules preserved.
**AC:**
- [ ] all three `DPVLAYOUTS` fixtures render correctly on device
- [ ] live variable updates animate exactly the bound tiles (existing state-store tests extended)

### CD-704 · Parity harness (player vs preview)
**BP:** PLY-E02-T03 / QA · **Hat:** QA+MOB · **P:** P0 · **Est:** S · **Deps:** CD-703, CD-417
**Do:** Automated screenshot comparison: player render vs IDE Player Preview per fixture × device class × orientation, with tolerance thresholds; run in CI (Android emulator) + manual device pass.
**AC:**
- [ ] parity report generated; deviations either fixed or waivered with rationale

### CD-705 · Delete `client/designer/`
**BP:** PLY-E01 / assessment transition rule · **Hat:** MOB · **P:** P0 · **Est:** S · **Deps:** CD-703, CD-704
**Do:** Remove `lib/designer/` + `lib/data/` seed-designer coupling in one commit; migrate anything still referenced (icons, schemas) to player modules; prune dead deps.
**AC:**
- [ ] tree builds + tests green with the directory gone; APK size drop recorded

### CD-706 · Manifest-driven widget registry adapter
**BP:** PLY-E03-T01 · **Hat:** MOB · **P:** P0 · **Est:** S · **Deps:** CD-702
**Do:** Player widget registry keyed by manifest IDs (engine serves the catalog subset); unknown-widget fallback tile (name + "update app" hint).
**AC:**
- [ ] registry parity matrix vs GA catalog (CD-611) generated; unknown widget renders fallback, not crash

### CD-707 · GA gap widgets (player side)
**BP:** PLY-E03-T03 · **Hat:** MOB · **P:** P0 · **Est:** M · **Deps:** CD-706, CD-611
**Do:** Build player renderings for GA-catalog widgets missing from the existing 28 (per the parity matrix).
**AC:**
- [ ] parity matrix 100 % for the GA catalog; each new widget has a widget test

### CD-708 · Interaction verbs + haptics + latency probe
**BP:** PLY-E04 · **Hat:** MOB · **P:** P0 · **Est:** M · **Deps:** CD-703
**Do:** Verb capture aligned with the IDE contract (tap/hold-480ms/slide/toggle + destructive confirm second-tap); haptic feedback per verb; interaction→engine dispatch with client-side timing probe reporting round-trip to the engine (surfaces in Devices workspace).
**AC:**
- [ ] each verb dispatches the correct interaction event (tests)
- [ ] p95 round-trip < 100 ms measured on real LAN (record number)

### CD-709 · Offline layout cache + reconnect UX
**BP:** PLY-E05 · **Hat:** MOB · **P:** P0 · **Est:** S · **Deps:** CD-703
**Do:** Persist last layout per engine (doc-version stamped); cold-launch offline renders cached deck with offline banner + disabled interactions; existing heartbeat/watchdog reconnect preserved; cache invalidated on version mismatch.
**AC:**
- [ ] airplane-mode launch shows cached deck; reconnect restores live within the existing self-heal window (wifi-kill test)

### CD-710 · Pairing UX v2 ∥
**BP:** PLY-E06 · **Hat:** MOB+DES · **P:** P1 · **Est:** S · **Deps:** CD-701
**Do:** QR flow polish (camera + paste fallback), device naming at pair time, trust screen (engine fingerprint display) matching the IDE Devices workspace vocabulary.
**AC:**
- [ ] pair → named device appears in IDE Devices; fingerprint shown both ends

### CD-711 · iOS build + entitlements (Mac)
**BP:** PLY-E07-T01 · **Hat:** MOB · **P:** P0* · **Est:** M · **Deps:** CD-703, A4 Mac
**Do:** Xcode project config, signing, entitlements; local-network usage descriptions (`NSLocalNetworkUsageDescription`, Bonjour service types for mDNS).
**AC:**
- [ ] debug build runs on a physical iPhone; discovery permission prompt appears correctly

### CD-712 · iOS quirks + local-network permission (Mac)
**BP:** PLY-E07-T02 · **Hat:** MOB · **P:** P0* · **Est:** M · **Deps:** CD-711
**Do:** iOS-specific fixes: background socket suspension handling (reconnect on foreground), safe-area rendering, haptics API, permission-denied recovery flow.
**AC:**
- [ ] full M7 device journey green on iPhone; background→foreground self-heals

### CD-713 · TestFlight distribution (Mac)
**BP:** PLY-E07-T03 / DEV-E05 · **Hat:** DO · **P:** P1 · **Est:** S · **Deps:** CD-712
**Do:** Archive pipeline, App Store Connect setup, TestFlight internal group; store-review compliance notes for the eventual listing (CD-815).
**AC:**
- [ ] beta testers install via TestFlight and pair successfully

### CD-714 · Android release build + Windows player build
**BP:** DEV-E05 / D8 · **Hat:** DO+MOB · **P:** P0 · **Est:** S · **Deps:** CD-705…709
**Do:** Signed release APK (upload keystore, R8 config) on an internal track pipeline; Windows player build target from the same codebase (D8); artifact publishing in CI.
**AC:**
- [ ] release APK installs + pairs on 2 physical Android devices
- [ ] Windows player runs the same deck

### CD-715 · **M7 gate review**
**BP:** Blueprint M7 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-701…714 (iOS tickets or recorded deferral)
**Do:** Device-matrix demo, recorded: author → publish → render on every target; latency + resilience numbers logged.
**AC:**
- [ ] matrix green: 2× Android, iPhone (or deferral), tablet, Windows player
- [ ] p95 round-trip < 100 ms; wifi-kill self-heal; offline cache verified
- [ ] `client/designer/` confirmed gone; player suites green in CI
