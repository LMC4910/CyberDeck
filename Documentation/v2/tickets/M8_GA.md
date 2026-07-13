# M8 — GA Hardening & Release (CD-801…816)

**Gate:** the success-metrics table (`04` §L1) is green with recorded numbers · beta soak ≥ 2 weeks with crash-free > 99.5 % · security findings burned down · staged rollout beta→stable executed. **This milestone ends with the product shipped.**
**Entry:** CD-715 passed. **Exit:** CD-816 signed.

## Board

- [ ] CD-801 Accessibility final audit + fixes
- [ ] CD-802 Performance pass vs budgets
- [ ] CD-803 Security: threat-model pass + burn-down
- [ ] CD-804 Supply chain: SBOM, licenses, signed releases
- [ ] CD-805 User docs
- [ ] CD-806 Extension-author docs
- [ ] CD-807 Runbooks + troubleshooting
- [ ] CD-808 In-app onboarding + sample project
- [ ] CD-809 Beta program launch
- [ ] CD-810 Beta soak + triage cycles
- [ ] CD-811 Website, demo video, press kit, release notes
- [ ] CD-812 Support intake + community channel
- [ ] CD-813 Full release regression run
- [ ] CD-814 GA release (staged rollout)
- [ ] CD-815 Store listings (post-GA gate)
- [ ] CD-816 **GA sign-off + retrospective**

---

### CD-801 · Accessibility final audit + fixes
**BP:** IDE-E20-T03 / QA-E04 · **Hat:** FE+QA · **P:** P0 · **Est:** M · **Deps:** CD-715
**Do:** Full keyboard-only journey across all workspaces; axe sweep; screen-reader labels on player tiles (TalkBack/VoiceOver spot pass); reduced-motion verification; fix or waiver every finding.
**AC:**
- [ ] 100 % chrome keyboard-operable (recorded walkthrough)
- [ ] axe: zero criticals; waivers documented

### CD-802 · Performance pass vs budgets
**BP:** QA-E04 · **Hat:** FE+QA · **P:** P0 · **Est:** M · **Deps:** CD-715
**Do:** Measure against every `04` §L1 target (boot warm/cold, canvas fps, ws-switch, bundle, memory after 1 h session, player round-trip); profile + fix the misses; freeze budgets as blocking CI gates.
**AC:**
- [ ] all targets green with numbers recorded in this ticket
- [ ] no leak: 1 h soak memory delta within threshold

### CD-803 · Security: threat-model pass + burn-down ∥
**BP:** SEC-E05 · **Hat:** SEC · **P:** P0 · **Est:** M · **Deps:** CD-715
**Do:** STRIDE pass over pairing/crypto, control plane, extension sandbox, expression sandbox, updater; consolidate CD-517/606 notes; fix criticals/highs, schedule/waiver the rest.
**AC:**
- [ ] threat-model doc committed; zero open critical/high findings

### CD-804 · Supply chain: SBOM, licenses, signed releases ∥
**BP:** SEC-E04 · **Hat:** SEC+DO · **P:** P1 · **Est:** S · **Deps:** CD-715
**Do:** SBOM generation in release CI; license report (no copyleft surprises across npm/Go/pub); all release artifacts signed; lockfile audit gate.
**AC:**
- [ ] SBOM + license report attached to the release; audit gate green

### CD-805 · User docs ∥
**BP:** DOC-E01 · **Hat:** DOC · **P:** P0 · **Est:** M · **Deps:** CD-715
**Do:** Getting started (install → pair → first deck < 10 min), per-workspace guides, flows cookbook (5 recipes incl. OBS + Spotify), FAQ.
**AC:**
- [ ] a fresh beta user reaches a live deck using only the docs (moderated test — feeds the < 10 min metric)

### CD-806 · Extension-author docs ∥
**BP:** DOC-E02 · **Hat:** DOC · **P:** P1 · **Est:** S · **Deps:** CD-605
**Do:** SDK guide (from CD-605 draft), manifest field reference (generated from schema descriptions), sample-extension walkthrough.
**AC:**
- [ ] an external dev builds the sample from docs alone (test with one volunteer)

### CD-807 · Runbooks + troubleshooting ∥
**BP:** DOC-E03 · **Hat:** DOC+DO · **P:** P1 · **Est:** S · **Deps:** CD-616
**Do:** Install/upgrade/rollback runbooks per OS; troubleshooting matrix (port 8765/firewall, pairing token expiry, fingerprint mismatch, engine service states, diagnostics ZIP usage); support macros.
**AC:**
- [ ] every known failure mode from beta triage has a runbook entry

### CD-808 · In-app onboarding + sample project
**BP:** DOC-E04 · **Hat:** FE+DES · **P:** P1 · **Est:** M · **Deps:** CD-715
**Do:** First-run tour v2 (target-guarded steps), bundled sample project (showcases bindings/components/flows), designed empty states for every workspace.
**AC:**
- [ ] fresh profile: tour completes; sample deck publishes to a device without docs

### CD-809 · Beta program launch
**BP:** REL-E03 · **Hat:** PM+REL · **P:** P0 · **Est:** S · **Deps:** CD-715, CD-617
**Do:** Recruit 20–50 users across the four personas; consent + telemetry onboarding (D4); feedback channel + weekly triage ritual; exit criteria = success-metrics table.
**AC:**
- [ ] ≥ 20 active testers with ≥ 1 paired device each; triage ritual running

### CD-810 · Beta soak + triage cycles
**BP:** REL-E03 / QA-E05 · **Hat:** ALL · **P:** P0 · **Est:** L (2-week soak) · **Deps:** CD-809
**Do:** ≥ 2-week soak on the beta channel; weekly fix waves via auto-update; track crash-free sessions, top friction, latency distribution from the field.
**AC:**
- [ ] crash-free > 99.5 % over the final week; zero open P0/P1 bugs
- [ ] all exit-criteria metrics green or explicitly waivered by PM

### CD-811 · Website, demo video, press kit, release notes ∥
**BP:** REL-E01/E02 · **Hat:** REL · **P:** P1 · **Est:** M · **Deps:** CD-715
**Do:** Name/mark sanity check; landing page (download + docs links); 90-second demo video (author → publish → phone tap → OBS switches); screenshots; press kit; release-notes pipeline from the running draft.
**AC:**
- [ ] site live with working downloads; video published; v1.0 notes drafted

### CD-812 · Support intake + community channel ∥
**BP:** SUP-E01/E02 · **Hat:** SUP · **P:** P1 · **Est:** S · **Deps:** CD-809
**Do:** Issue templates (bug/feature/extension) + labels + triage SLA; GitHub Discussions or Discord with moderation baseline; link from app Help menu.
**AC:**
- [ ] intake tested by beta users; Help menu links resolve

### CD-813 · Full release regression run
**BP:** QA-E05 · **Hat:** QA · **P:** P0 · **Est:** M · **Deps:** CD-801…810
**Do:** Execute the complete manual QA matrix (every milestone gate checklist + device matrix + install/upgrade/rollback per OS) on the GA candidate build; log + fix + rerun until clean.
**AC:**
- [ ] signed regression report on the exact GA build hash

### CD-814 · GA release (staged rollout)
**BP:** L11 deployment plan · **Hat:** DO+PM · **P:** P0 · **Est:** S · **Deps:** CD-813
**Do:** Tag v1.0.0; publish signed artifacts (Windows installer, Linux, macOS if available, APK); staged rollout 25 %→100 % over 48 h with crash-rate watch; rollback armed.
**AC:**
- [ ] 100 % rollout completed with crash-free ≥ threshold; announcement posted

### CD-815 · Store listings (post-GA gate) ∥
**BP:** REL-E04 / D5 · **Hat:** REL+DO · **P:** P2 · **Est:** M · **Deps:** CD-814, CD-713
**Do:** Google Play listing (data-safety form, screenshots) + App Store listing (review notes re local-network usage); submit; respond to review.
**AC:**
- [ ] both stores approved + live (or rejection remediation plan filed)

### CD-816 · **GA sign-off + retrospective**
**BP:** Readiness review closure · **Hat:** PM · **P:** P0 · **Est:** S · **Deps:** CD-814
**Do:** Final scorecard vs `04` §L1 metrics; retrospective (what the ticket system got wrong — feed corrections into BACKLOG + post-GA roadmap: marketplace UI, cloud sync, AI providers, collaboration).
**AC:**
- [ ] scorecard committed with real numbers
- [ ] post-GA roadmap seeded in BACKLOG.md — **project v1 complete** 🎉
