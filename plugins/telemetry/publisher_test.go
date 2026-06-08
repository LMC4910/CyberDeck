package main

import (
	"bytes"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

// fakeProvider is a pal.Telemetry whose values and availability are set by the test.
type fakeProvider struct {
	cpu, ram, netv, disk, up         float64
	cpuOK, ramOK, netOK, diskOK, uOK bool
}

func (f *fakeProvider) CPUPercent() (float64, bool)      { return f.cpu, f.cpuOK }
func (f *fakeProvider) MemUsedPercent() (float64, bool)  { return f.ram, f.ramOK }
func (f *fakeProvider) NetThroughput() (float64, bool)   { return f.netv, f.netOK }
func (f *fakeProvider) DiskUsedPercent() (float64, bool) { return f.disk, f.diskOK }
func (f *fakeProvider) UptimeSeconds() (float64, bool)   { return f.up, f.uOK }

func allAvailable() *fakeProvider {
	return &fakeProvider{
		cpu: 12, ram: 40, netv: 1000, disk: 55, up: 3600,
		cpuOK: true, ramOK: true, netOK: true, diskOK: true, uOK: true,
	}
}

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
	pub := NewPublisher(allAvailable(), newMsgWriter(&buf), DefaultCadences(), 85, 90)

	if err := pub.PublishDue(time.Unix(0, 0)); err != nil {
		t.Fatalf("PublishDue: %v", err)
	}
	st := states(decodeMessages(t, &buf))
	for _, id := range systemStates() {
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
	pub := NewPublisher(prov, newMsgWriter(&buf), DefaultCadences(), 85, 90)

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
	pub := NewPublisher(prov, newMsgWriter(&buf), DefaultCadences(), 85, 90)
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
	pub := NewPublisher(prov, newMsgWriter(&buf), DefaultCadences(), 85, 90)

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
