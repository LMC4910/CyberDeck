package main

import (
	"bytes"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

// fakeProvider is a pal.Telemetry + extendedTelemetry whose values and
// availability are set by the test.
type fakeProvider struct {
	cpu, ram, netv, disk, up         float64
	cpuOK, ramOK, netOK, diskOK, uOK bool
	// Extended (gopsutil-backed) metrics.
	memUsed, memFree, memTotal float64
	rx, tx                     float64
	diskC, diskD, diskE, diskF float64
	extOK                      bool // RAM bytes + net rx/tx availability
	cOK, dOK, eOK, fOK         bool // per-drive availability
}

func (f *fakeProvider) CPUPercent() (float64, bool)      { return f.cpu, f.cpuOK }
func (f *fakeProvider) MemUsedPercent() (float64, bool)  { return f.ram, f.ramOK }
func (f *fakeProvider) NetThroughput() (float64, bool)   { return f.netv, f.netOK }
func (f *fakeProvider) DiskUsedPercent() (float64, bool) { return f.disk, f.diskOK }
func (f *fakeProvider) UptimeSeconds() (float64, bool)   { return f.up, f.uOK }

func (f *fakeProvider) MemUsedBytes() (float64, bool)     { return f.memUsed, f.extOK }
func (f *fakeProvider) MemFreeBytes() (float64, bool)     { return f.memFree, f.extOK }
func (f *fakeProvider) MemTotalBytes() (float64, bool)    { return f.memTotal, f.extOK }
func (f *fakeProvider) NetRxBytesPerSec() (float64, bool) { return f.rx, f.extOK }
func (f *fakeProvider) NetTxBytesPerSec() (float64, bool) { return f.tx, f.extOK }
func (f *fakeProvider) DiskPercentFor(mount string) (float64, bool) {
	switch mount {
	case diskMountC:
		return f.diskC, f.cOK
	case diskMountD:
		return f.diskD, f.dOK
	case diskMountE:
		return f.diskE, f.eOK
	case diskMountF:
		return f.diskF, f.fOK
	}
	return 0, false
}

func allAvailable() *fakeProvider {
	return &fakeProvider{
		cpu: 12, ram: 40, netv: 1000, disk: 55, up: 3600,
		cpuOK: true, ramOK: true, netOK: true, diskOK: true, uOK: true,
		memUsed: 10 << 30, memFree: 6 << 30, memTotal: 16 << 30, rx: 800, tx: 200,
		diskC: 58, diskD: 30, diskE: 20, diskF: 10,
		extOK: true, cOK: true, dOK: true, eOK: true, fOK: true,
	}
}

// fakeGPU is a pal.GPU whose values and availability are set by the test.
type fakeGPU struct {
	load, temp, vu, vt         float64
	loadOK, tempOK, vuOK, vtOK bool
}

func (g *fakeGPU) Load() (float64, bool)      { return g.load, g.loadOK }
func (g *fakeGPU) Temp() (float64, bool)      { return g.temp, g.tempOK }
func (g *fakeGPU) VRAMUsed() (float64, bool)  { return g.vu, g.vuOK }
func (g *fakeGPU) VRAMTotal() (float64, bool) { return g.vt, g.vtOK }

// allGPU is a fully available GPU well under the over-temp threshold.
func allGPU() *fakeGPU {
	return &fakeGPU{
		load: 30, temp: 60, vu: 2 << 30, vt: 8 << 30,
		loadOK: true, tempOK: true, vuOK: true, vtOK: true,
	}
}

// unavailableGPU is a GPU chain that bound nothing (no supported GPU): every read
// is ok=false, mirroring the real degraded capability.
type unavailableGPU struct{}

func (unavailableGPU) Load() (float64, bool)      { return 0, false }
func (unavailableGPU) Temp() (float64, bool)      { return 0, false }
func (unavailableGPU) VRAMUsed() (float64, bool)  { return 0, false }
func (unavailableGPU) VRAMTotal() (float64, bool) { return 0, false }

// decodeMessages parses every newline-delimited message written to buf.
func decodeMessages(t *testing.T, buf *bytes.Buffer) []ipcproto.Message {
	t.Helper()
	var out []ipcproto.Message
	for _, line := range bytes.Split(bytes.TrimRight(buf.Bytes(), "\n"), []byte("\n")) {
		if len(line) == 0 {
			continue
		}
		m, err := ipcproto.Decode(line)
		if err != nil {
			t.Fatalf("decode %q: %v", line, err)
		}
		out = append(out, m)
	}
	return out
}

func states(msgs []ipcproto.Message) map[string]any {
	m := make(map[string]any)
	for _, msg := range msgs {
		if msg.Type == ipcproto.MsgStateUpdate && msg.State != nil {
			m[msg.State.ID] = msg.State.Value
		}
	}
	return m
}

func eventTopics(msgs []ipcproto.Message) []string {
	var ts []string
	for _, msg := range msgs {
		if msg.Type == ipcproto.MsgEvent && msg.Event != nil {
			ts = append(ts, msg.Event.Topic)
		}
	}
	return ts
}

func TestPublishDueEmitsAllMetricsFirstTick(t *testing.T) {
	var buf bytes.Buffer
	pub := NewPublisher(allAvailable(), allGPU(), newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)

	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatalf("PublishDue: %v", err)
	}
	st := states(decodeMessages(t, &buf))
	for _, id := range systemStates() {
		if id == stateSystemInfo {
			continue // published once at startup (run()), not via the cadence loop
		}
		if _, ok := st[id]; !ok {
			t.Errorf("missing state %q on first tick", id)
		}
	}
	if got := st[stateCPU]; got != 12.0 {
		t.Errorf("cpu = %v, want 12", got)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); len(topics) != 0 {
		t.Errorf("unexpected threshold events below limits: %v", topics)
	}
}

func TestPublishDueRespectsCadence(t *testing.T) {
	var buf bytes.Buffer
	prov := allAvailable()
	pub := NewPublisher(prov, allGPU(), newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)

	t0 := time.Unix(100, 0)
	if err := pub.PublishDue(t0); err != nil { // all five due
		t.Fatal(err)
	}
	buf.Reset()

	// +1s: CPU/RAM/Net (1s) due; Disk (10s) and Uptime (60s) not yet.
	if err := pub.PublishDue(t0.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	for _, id := range []string{stateCPU, stateRAM, stateNet} {
		if _, ok := st[id]; !ok {
			t.Errorf("%q should have re-published at +1s", id)
		}
	}
	for _, id := range []string{stateDisk, stateUptime} {
		if _, ok := st[id]; ok {
			t.Errorf("%q published before its cadence elapsed", id)
		}
	}
}

func TestThresholdEventOnUnderToOverTransitionOnly(t *testing.T) {
	var buf bytes.Buffer
	prov := allAvailable()
	pub := NewPublisher(prov, allGPU(), newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)
	t0 := time.Unix(0, 0)

	// Over the CPU limit → one event.
	prov.cpu = 90
	if err := pub.PublishDue(t0); err != nil {
		t.Fatal(err)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); len(topics) != 1 || topics[0] != topicCPUHigh {
		t.Fatalf("first crossing topics = %v, want [%s]", topics, topicCPUHigh)
	}
	buf.Reset()

	// Still over → no repeat event.
	if err := pub.PublishDue(t0.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); len(topics) != 0 {
		t.Fatalf("sustained over-limit should not re-emit: %v", topics)
	}
	buf.Reset()

	// Drop below then back over → event fires again.
	prov.cpu = 50
	if err := pub.PublishDue(t0.Add(2 * time.Second)); err != nil {
		t.Fatal(err)
	}
	prov.cpu = 95
	if err := pub.PublishDue(t0.Add(3 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); len(topics) != 1 || topics[0] != topicCPUHigh {
		t.Fatalf("re-crossing topics = %v, want [%s]", topics, topicCPUHigh)
	}
}

func TestUnavailableMetricSkipped(t *testing.T) {
	var buf bytes.Buffer
	prov := allAvailable()
	prov.cpuOK = false // CPU unavailable this host
	pub := NewPublisher(prov, allGPU(), newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)

	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	if _, ok := st[stateCPU]; ok {
		t.Error("unavailable CPU metric should not be published")
	}
	if _, ok := st[stateRAM]; !ok {
		t.Error("available RAM metric should still publish")
	}
}

// TestGPUMetricsPublishWhenAvailable proves the four GPU states flow as typed
// scalars when the GPU chain is bound (PROJ-172).
func TestGPUMetricsPublishWhenAvailable(t *testing.T) {
	var buf bytes.Buffer
	gpu := allGPU()
	pub := NewPublisher(allAvailable(), gpu, newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)

	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	for _, id := range []string{stateGPULoad, stateGPUTemp, stateGPUVRAMUsed, stateGPUVRAMTotal} {
		if _, ok := st[id]; !ok {
			t.Errorf("missing GPU state %q", id)
		}
	}
	if got := st[stateGPULoad]; got != 30.0 {
		t.Errorf("gpu load = %v, want 30", got)
	}
}

// TestGPUUnavailableDegradesToDashes proves that on a machine with no supported
// GPU (unbound chain → every read ok=false) the GPU states are simply skipped
// ("--") with no crash, while non-GPU metrics still publish.
func TestGPUUnavailableDegradesToDashes(t *testing.T) {
	var buf bytes.Buffer
	pub := NewPublisher(allAvailable(), unavailableGPU{}, newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)

	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	for _, id := range []string{stateGPULoad, stateGPUTemp, stateGPUVRAMUsed, stateGPUVRAMTotal} {
		if _, ok := st[id]; ok {
			t.Errorf("unavailable GPU metric %q must not publish", id)
		}
	}
	if _, ok := st[stateCPU]; !ok {
		t.Error("non-GPU metric should still publish when GPU is unavailable")
	}
}

// TestGPUOverTempEmitsThresholdEvent proves a GPU temp strictly above the limit
// fires system.gpu.high exactly once per under→over crossing (PROJ-172).
func TestGPUOverTempEmitsThresholdEvent(t *testing.T) {
	var buf bytes.Buffer
	gpu := allGPU()
	pub := NewPublisher(allAvailable(), gpu, newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)
	t0 := time.Unix(0, 0)

	// Below the 88C limit → no event.
	gpu.temp = 70
	if err := pub.PublishDue(t0); err != nil {
		t.Fatal(err)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); contains(topics, topicGPUHigh) {
		t.Fatalf("GPU event fired below limit: %v", topics)
	}
	buf.Reset()

	// Cross above 88C → exactly one gpu.high event.
	gpu.temp = 91
	if err := pub.PublishDue(t0.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); len(topics) != 1 || topics[0] != topicGPUHigh {
		t.Fatalf("over-temp topics = %v, want [%s]", topics, topicGPUHigh)
	}
	buf.Reset()

	// Still over → no repeat (under→over only).
	if err := pub.PublishDue(t0.Add(2 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if topics := eventTopics(decodeMessages(t, &buf)); contains(topics, topicGPUHigh) {
		t.Fatalf("sustained over-temp re-emitted: %v", topics)
	}
}

// TestExtendedMetricsPublish proves the gopsutil-backed extended metrics (RAM
// byte breakdown, rx/tx split, per-drive storage) flow as typed scalars when the
// provider supports them.
func TestExtendedMetricsPublish(t *testing.T) {
	var buf bytes.Buffer
	pub := NewPublisher(allAvailable(), allGPU(), newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)
	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	want := map[string]float64{
		stateRAMUsed: float64(10 << 30), stateRAMFree: float64(6 << 30),
		stateRAMTotal: float64(16 << 30), stateNetRx: 800, stateNetTx: 200,
		stateDiskC: 58, stateDiskD: 30,
	}
	for id, v := range want {
		if st[id] != v {
			t.Errorf("%s = %v, want %v", id, st[id], v)
		}
	}
}

// TestAbsentDriveSkipped proves a drive that doesn't exist (ok=false) is not
// published, so that storage slot shows "--".
func TestAbsentDriveSkipped(t *testing.T) {
	var buf bytes.Buffer
	prov := allAvailable()
	prov.dOK = false // D: not present on this host
	pub := NewPublisher(prov, allGPU(), newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)
	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	if _, ok := st[stateDiskD]; ok {
		t.Error("absent drive D: must not publish")
	}
	if _, ok := st[stateDiskC]; !ok {
		t.Error("present drive C: should publish")
	}
}

// baseProvider implements only pal.Telemetry (NOT extendedTelemetry), proving the
// publisher skips the extended metrics for providers that don't support them.
type baseProvider struct{}

func (baseProvider) CPUPercent() (float64, bool)      { return 10, true }
func (baseProvider) MemUsedPercent() (float64, bool)  { return 40, true }
func (baseProvider) NetThroughput() (float64, bool)   { return 0, true }
func (baseProvider) DiskUsedPercent() (float64, bool) { return 50, true }
func (baseProvider) UptimeSeconds() (float64, bool)   { return 100, true }

func TestBaseProviderSkipsExtendedMetrics(t *testing.T) {
	var buf bytes.Buffer
	pub := NewPublisher(baseProvider{}, unavailableGPU{}, newMsgWriter(&buf), DefaultCadences(), 85, 90, 88)
	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatal(err)
	}
	st := states(decodeMessages(t, &buf))
	for _, id := range []string{stateRAMUsed, stateNetRx, stateDiskC} {
		if _, ok := st[id]; ok {
			t.Errorf("base-only provider must not publish extended metric %q", id)
		}
	}
	if _, ok := st[stateCPU]; !ok {
		t.Error("base metric should still publish")
	}
}

func contains(ss []string, want string) bool {
	for _, s := range ss {
		if s == want {
			return true
		}
	}
	return false
}
