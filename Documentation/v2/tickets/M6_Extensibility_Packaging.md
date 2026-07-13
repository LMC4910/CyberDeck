# M6 — Extensibility & Desktop Packaging (CD-601…619)

**Gate:** a sandboxed extension installs, contributes widgets/commands/nodes, crashes without harming the shell, and uninstalls cleanly · OBS + Spotify integrations drive a live deck · clean-machine **Windows** install (IDE + engine sidecar) · close IDE → deck still served · auto-update beta channel works.
**Entry:** CD-519 passed. **Exit:** CD-619 recorded.
**Procurement (start immediately):** Windows signing cert (D6) and Apple Developer account (A4) — lead times gate CD-615/M7.

## Board

- [ ] CD-601 Extension worker host + lifecycle
- [ ] CD-602 RPC bridge + permission-mediated API
- [ ] CD-603 Contribution points registration
- [ ] CD-604 Crash isolation + kill-switch
- [ ] CD-605 Extension SDK: package format + dev harness + sample
- [ ] CD-606 Sandbox security audit + enforcement tests
- [ ] CD-607 OBS engine plugin
- [ ] CD-608 OBS IDE extension
- [ ] CD-609 Spotify engine plugin
- [ ] CD-610 Spotify IDE extension
- [ ] CD-611 Widget catalog convergence (GA set)
- [ ] CD-612 Tauri shell + adapters + IPC allowlist
- [ ] CD-613 Engine sidecar management
- [ ] CD-614 Tray + native menus
- [ ] CD-615 Windows installer + signing + service
- [ ] CD-616 Auto-update channels + rollback
- [ ] CD-617 Crash reporting + diagnostics bundle
- [ ] CD-618 macOS/Linux packaging (as hardware allows)
- [ ] CD-619 **M6 gate review**

---

### CD-601 · Extension worker host + lifecycle
**BP:** IDE-E19-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-519
**Do:** Worker-per-extension host (`pluginSandbox` flag hard-on for third-party); lifecycle: discover → validate manifest → lazy-activate on first use → deactivate/dispose; extension state surfaced in Platform Inspector.
**AC:**
- [ ] activation is lazy (test: no worker until first use)
- [ ] deactivate releases all resources (leak test)

### CD-602 · RPC bridge + permission-mediated API
**BP:** IDE-E19-T02 · **Hat:** FE+SEC · **P:** P0 · **Est:** L · **Deps:** CD-601, CD-422
**Do:** Typed RPC bridge (structured-clone messages, request/response + events); the **only** API surface extensions get: commands, notifications, variables (scoped), widgets, storage (scoped), events — every call checked against declared+granted permissions; API typings published as the SDK's type package.
**AC:**
- [ ] undeclared capability call rejects at the bridge (test corpus)
- [ ] API typings compile a sample extension with zero `any`

### CD-603 · Contribution points registration
**BP:** IDE-E19-T03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-602
**Do:** Manifest contribution points → live registries: widgets (→ CD-419 path), commands (+palette/keys), menus/context menus, settings pane entries, themes, flow nodes (IDE side), data providers. Uninstall removes every contribution.
**AC:**
- [ ] sample extension contributes one of each; uninstall leaves zero residue (registry diff test)

### CD-604 · Crash isolation + kill-switch
**BP:** IDE-E19-T04 · **Hat:** FE+QA · **P:** P0 · **Est:** S · **Deps:** CD-601
**Do:** Worker crash → contributions marked unavailable + fallback UI + notification + restart-with-backoff; per-extension kill-switch (disable) in settings; chaos test (extension that throws/spins/leaks).
**AC:**
- [ ] chaos suite: shell never degrades; spin detected by watchdog + terminated

### CD-605 · Extension SDK: package format + dev harness + sample
**BP:** EXT-E01 · **Hat:** FE+DOC · **P:** P0 · **Est:** M · **Deps:** CD-602, CD-603
**Do:** Package format (manifest + chunks + assets, signed hash list); "load unpacked" dev flow with reload; sample extension template repo (widget + command + node + settings); SDK doc draft (feeds CD-806).
**AC:**
- [ ] third-party-shaped sample builds from the template and runs unmodified
- [ ] load-unpacked reload cycle < 5 s

### CD-606 · Sandbox security audit + enforcement tests ∥
**BP:** SEC-E02 · **Hat:** SEC · **P:** P0 · **Est:** M · **Deps:** CD-602, CD-604
**Do:** Review the RPC surface (prototype pollution, clone-cycle, permission-bypass attempts); escape-attempt corpus in CI; document residual risks + mitigations.
**AC:**
- [ ] escape corpus green; findings filed + fixed or accepted with rationale

### CD-607 · OBS engine plugin
**BP:** EXT-E02 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-513
**Do:** Engine plugin speaking obs-websocket v5 (pinned): connection settings (host/port/password via secretstore), variables (current scene, streaming/recording state, stats), actions (set scene, toggle stream/record, mute source); reconnect with backoff.
**AC:**
- [ ] against a real OBS instance: vars tick, actions fire, disconnect self-heals
- [ ] permissions declared `{network, notifications}` and enforced

### CD-608 · OBS IDE extension
**BP:** EXT-E02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-605, CD-607
**Do:** IDE half of the pair (one package ID): scene-grid + stream-status widgets, flow nodes (OBS event trigger, scene action), settings pane; installs via the SDK path.
**AC:**
- [ ] deck with scene buttons switches real OBS scenes from player preview
- [ ] pair installs/uninstalls as one unit

### CD-609 · Spotify engine plugin ∥
**BP:** EXT-E03 · **Hat:** BE · **P:** P1 · **Est:** M · **Deps:** CD-513
**Do:** PKCE auth (tokens in secretstore, refresh handling); now-playing variables (track/artist/art/progress/state); transport actions (play/pause/next/prev/volume); API-rate-limit respectful polling/push.
**AC:**
- [ ] auth round-trip; vars + transport verified against a real account
- [ ] token refresh survives expiry mid-session (test with short-lived token)

### CD-610 · Spotify IDE extension ∥
**BP:** EXT-E03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-605, CD-609
**Do:** Now-playing widget (art/title/progress), transport buttons, volume slider node/action; pair packaging.
**AC:**
- [ ] media deck controls real playback end-to-end

### CD-611 · Widget catalog convergence (GA set)
**BP:** EXT-E04 · **Hat:** FE+DES+PM · **P:** P1 · **Est:** M · **Deps:** CD-423
**Do:** Audit design's 61 catalog entries ∪ player's 28 widgets → decide the GA manifest set (PM sign-off recorded); build the gaps that made the cut; mark post-GA rest in BACKLOG.
**AC:**
- [ ] signed-off GA catalog list committed; every listed manifest registered + rendering

### CD-612 · Tauri shell + adapters + IPC allowlist
**BP:** DEV-E02 · **Hat:** DO+FE · **P:** P0 · **Est:** M · **Deps:** CD-519
**Do:** Tauri app hosting the IDE build; swap storage/config adapters from localStorage → app-data fs (one interface, CD-118); strict IPC allowlist (SEC-reviewed); window state persistence; deep-link `cyberdeck://` (for future pairing links).
**AC:**
- [ ] full M4 gate journey green inside Tauri
- [ ] IPC surface documented + reviewed; no `shell.open` style wildcards

### CD-613 · Engine sidecar management
**BP:** DEV-E02 · **Hat:** DO+BE · **P:** P0 · **Est:** M · **Deps:** CD-612
**Do:** Attach-before-spawn: detect an already-running engine service, else spawn the bundled engine as sidecar; health checks + restart with backoff; clean shutdown rules (never kill a *service* engine on IDE exit); status chip wiring.
**AC:**
- [ ] matrix test: no engine / sidecar engine / service engine — all attach correctly
- [ ] IDE crash leaves service engine untouched (test)

### CD-614 · Tray + native menus ∥
**BP:** DEV-E02 · **Hat:** DO · **P:** P2 · **Est:** S · **Deps:** CD-612
**Do:** Tray icon (engine status, open IDE, quit), native app menu mapping to registry commands.
**AC:**
- [ ] tray reflects engine state; menu items execute registry commands

### CD-615 · Windows installer + signing + service
**BP:** DEV-E03 · **Hat:** DO · **P:** P0 · **Est:** M · **Deps:** CD-613
**Do:** NSIS/MSI bundling IDE + engine + plugins; optional "install engine as service" step (reusing `--service install`); code signing (cert per D6 — self-signed for beta w/ documented SmartScreen caveat); upgrade preserves engine data (SQLite intact).
**AC:**
- [ ] clean-VM install → author → close IDE → deck served (the M6 core demo)
- [ ] upgrade-in-place test keeps projects + pairings

### CD-616 · Auto-update channels + rollback
**BP:** DEV-E04 · **Hat:** DO · **P:** P1 · **Est:** M · **Deps:** CD-615
**Do:** Tauri updater with beta/stable channels; staged-rollout metadata; keep-previous-version rollback; engine-doc version guard (older engine refuses newer docs cleanly).
**AC:**
- [ ] beta→beta update E2E on a VM; one-click rollback restores prior version

### CD-617 · Crash reporting + diagnostics bundle ∥
**BP:** DEV-E04 · **Hat:** DO+FE · **P:** P1 · **Est:** S · **Deps:** CD-612
**Do:** Consent-gated (D4) crash capture (IDE renderer + engine panics) with symbolication; "Save diagnostics ZIP" command (logs + config summary + versions, secrets scrubbed).
**AC:**
- [ ] induced crash produces a symbolicated report; ZIP contains no secret material (scrub test)

### CD-618 · macOS/Linux packaging (as hardware allows) ∥
**BP:** DEV-E03 · **Hat:** DO · **P:** P1 · **Est:** M · **Deps:** CD-615, (macOS: A4 Mac)
**Do:** Linux AppImage/deb now; macOS dmg + notarization when the Mac lands (else formal deferral note at CD-619 — Windows GA unaffected per A5).
**AC:**
- [ ] Linux install → M6 core demo green; macOS same or deferral recorded with plan

### CD-619 · **M6 gate review**
**BP:** Blueprint M6 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-601…618
**Do:** Record: extension chaos demo, OBS/Spotify live demo, clean-machine install video, update/rollback proof.
**AC:**
- [ ] sample extension: install → contribute → crash-isolate → uninstall clean
- [ ] OBS scene switch + Spotify control from a deck, live
- [ ] Windows clean install + IDE-closed deck service + beta-channel update all verified
