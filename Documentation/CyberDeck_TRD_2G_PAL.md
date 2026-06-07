# CyberDeck — TRD 2G: Platform Abstraction Layer (PAL)

**Subsystem TRD · Document 2G** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADR: **0007** (plugin host/isolation in 2F; registries in 2B).

## Contents
1. Scope & responsibilities
2. PAL ⟂ plugin host (the relationship)
3. Capability interface model
4. Provider chains: probe → bind → degrade
5. Worked example: the FPS chain
6. Capability catalog & per-OS availability matrix
7. Dependency & licensing register
8. Normative requirements

---

## 1. Scope & responsibilities

The PAL defines, **for each OS- or third-party-backed capability, a single Go interface plus an ordered list of providers** that implement it. It owns: the capability interface definitions, the provider-chain framework (probe/bind/re-probe), and the "unavailable is graceful" contract. It does **not** own process isolation (2F) or what a capability *contributes to registries* (2B) — a capability provider lives inside a plugin process (2F) and may publish states/actions (2B). PAL is *which implementation answers and in what priority*; 2F is *how that code is executed*.

## 2. PAL ⟂ plugin host (ADR-0007)

These are orthogonal and must not be conflated:
- **PAL** = capability **interface + provider priority**. ("FPS comes from native → PresentMon → FrameView → RTSS → vendor → unavailable.")
- **Plugin host (2F)** = **execution + isolation**. ("That provider's code runs in an out-of-process plugin the host supervises.")

They compose: a provider (e.g. the PresentMon FPS provider) is *both* a PAL chain entry *and* code inside a plugin process. The engine core calls a capability interface; the bound provider — inside its plugin — answers over IPC (2F §5). The core never branches on OS.

## 3. Capability interface model

Each capability is one Go interface; the engine calls it without knowing which provider (or OS) satisfies it.
```go
type Telemetry interface {
    CPULoad() (float64, bool)     // value, ok  (ok=false → unavailable)
    CPUTemp() (float64, bool)
    GPULoad() (float64, bool)
    GPUTemp() (float64, bool)
    // …
}
type FPS interface { Current() (int, bool) }
type MediaControl interface { /* play/pause/next/prev/meta */ }
type Power interface { /* shutdown/restart/sleep/… */ }
type Notifications interface { /* subscribe to OS action center */ }
```
The `(value, ok)` shape makes **unavailable** a normal return, never an error/panic. A capability with no bound provider returns `ok=false` for every call; bound states render `--` (2B) and flows can branch on availability (2D).

## 4. Provider chains: probe → bind → degrade

### 4.1 Declaration
A capability declares an **ordered** provider list (highest priority first), contributed via plugin manifests (2F §3) and merged by the host.
```
Capability "FPS" providers (priority order):
  1 native_app_telemetry   (only if we own the rendering pipeline — usually inert)
  2 presentmon             (Windows; open-source; no overlay; PRIMARY)
  3 frameview
  4 rtss
  5 vendor_api             (NVAPI/ADL — GPU telemetry reliable, per-app FPS not always)
  → unavailable
```

### 4.2 Probe & bind
At startup (and on a re-probe trigger — hardware/driver/plugin change), the host **probes each provider in priority order** and **binds the first that reports available**. Probing is cheap and side-effect-free (can this provider start? are its deps/permissions present?). The bound provider answers all interface calls until it faults or a re-probe rebinds.

### 4.3 Degrade
If **no** provider binds, the capability is **unavailable** — not an error, not a crash (ADR-0007). This is the same graceful-degradation contract as a disconnected device or a faulted plugin (2F §6): dependent states read `--`; nothing breaks. A provider that faults at runtime triggers a re-probe (may rebind to a lower-priority provider, or go unavailable).

### 4.4 Why ordering matters (rationale captured, not implicit)
- **PresentMon is primary on Windows**: open-source, actively maintained, no on-screen overlay to scrape, bundleable (subject to the licensing review in §7) — more stable as a telemetry source than scraping overlay tools.
- **Vendor APIs (NVAPI/ADL) rank *below* PresentMon for FPS** specifically because they reliably expose *GPU* telemetry (load/temp — useful for the Telemetry capability) but **not always per-application FPS**. They're a strong fallback for GPU metrics, a weak one for the FPS number.
- **native_app_telemetry ranks first but is usually inert** — it only applies if CyberDeck measures FPS of its *own* rendered content, which a control-surface product rarely does. Kept as the ideal-when-applicable top entry.

## 5. Worked example: the FPS chain (end to end)

```
Engine wants gaming.fps:
  host.Capability("FPS").Current()
    → bound provider = presentmon (on a Windows host where it probed available)
        → PresentMon plugin reads frame timing → returns (144, true)
    → StateStore.Set("gaming.fps", 144)  (2B)  → delta → State channel (2A) → gauge repaints

On a macOS host:
  probe: native(inert) → presentmon(Windows-only, unavailable) → frameview(unavailable)
         → rtss(unavailable) → vendor(no per-app FPS) → UNAVAILABLE
    → FPS.Current() returns (0, false) → state "gaming.fps" renders "--"
    → a flow with `if {gaming.fps} available` branch simply takes the else path
```
"Unavailable on this OS" is a normal outcome of the chain, not a gap to apologize for.

## 6. Capability catalog & per-OS availability (V1 expectation)

| Capability | Interface | Providers (priority) | Win | macOS | Linux | Phase |
|------------|-----------|----------------------|-----|-------|-------|-------|
| Telemetry (CPU/RAM/net/disk) | `Telemetry` | gopsutil → OS-native | ✓ | ✓ | ✓ | 1 |
| GPU telemetry | `Telemetry` (GPU) | GPUtil → OHM/AMD → vendor (NVAPI/ADL) → unavailable | ✓ | partial | partial | 1 |
| Power actions | `Power` | OS-native (shutdown/restart/sleep/lock) | ✓ | ✓ | ✓ | 1 |
| Media control/metadata | `MediaControl` | SMTC (Win) / MPNowPlaying (mac) / MPRIS (Linux) | ✓ | ✓ | ✓ | 1–2 |
| App launchers | `Launcher` | OS process launch | ✓ | ✓ | ✓ | 1 |
| Notifications (read) | `Notifications` | WinRT listener / mac UN / Linux portal | ✓ | partial | partial | 1/5 |
| FPS | `FPS` | native → PresentMon → FrameView → RTSS → vendor → unavailable | ✓ | ✗(→unavail) | ✗(→unavail) | 3 |
| Fan control | `Fans` | WMI/vendor → unavailable | partial | ✗ | partial | 3 |
| Smart home | (plugin actions/states) | Home Assistant REST + event bus | ✓ | ✓ | ✓ | 4 |

"partial" = provider exists but coverage varies by hardware/OS permission; the chain degrades to `unavailable` cleanly where unsupported. Honest cross-platform posture: several gaming/hardware capabilities are Windows-strong and degrade elsewhere — acceptable because the chain makes that non-breaking.

## 7. Dependency & licensing register

Tracked here so external dependencies don't surprise implementation:

| Dependency | Capability | Note / action |
|------------|------------|---------------|
| **PresentMon** | FPS (Win primary) | Open-source; **bundling requires a licensing review** (track to completion before shipping it bundled). |
| FrameView / RTSS | FPS fallback | Third-party install presence; provider probes for it, never requires it. |
| NVAPI / AMD ADL | GPU telemetry / FPS fallback | Vendor SDKs; per-app FPS unreliable (see §4.4). |
| gopsutil | Core telemetry | Permissive license; cross-platform. |
| Home Assistant | Smart home (P4) | User-run; long-lived token via secure store (2E §7). |
| OS media/notification APIs | Media/Notifications | Subject to per-OS permission models; degrade where denied. |

## 8. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TG-1 | Each OS/third-party capability SHALL be defined as one interface with an ordered provider list. | ADR-0007 |
| TG-2 | The host SHALL probe providers in priority order and bind the first available. | ADR-0007 |
| TG-3 | Absence of all providers SHALL yield `unavailable` (graceful), never an error or crash. | ADR-0007, FR-6.8 |
| TG-4 | Capability interfaces SHALL use a `(value, ok)` shape so unavailable is a normal return. | §3 |
| TG-5 | A runtime provider fault SHALL trigger a re-probe that may rebind or go unavailable. | §4.3 |
| TG-6 | FPS provider priority SHALL be native → PresentMon → FrameView → RTSS → vendor → unavailable. | PRD D11-02 |
| TG-7 | Vendor APIs SHALL NOT be relied upon for per-application FPS; they MAY serve GPU telemetry. | §4.4 |
| TG-8 | The engine core SHALL call capability interfaces only; it SHALL contain no OS branch. | ADR-0007, FR-11.4 |
| TG-9 | A capability provider SHALL execute inside a plugin process (2F); PAL priority and process isolation are orthogonal. | ADR-0007 |
| TG-10 | Bundled third-party dependencies (e.g. PresentMon) SHALL pass a licensing review before shipping. | §7 |

---
*End of TRD 2G (Draft v0.1). Provider implementations are first-party plugins (2F); states/actions they contribute follow 2B registries.*
