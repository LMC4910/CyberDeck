package main

import (
	"encoding/json"
	"io"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/pal"
	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

// Typed system.* state IDs published by the telemetry plugin (ADR-0019: values are
// typed scalars, not formatted strings — the client formats for display).
const (
	stateCPU    = "system.cpu.percent"
	stateRAM    = "system.ram.percent"
	stateNet    = "system.net.throughput"
	stateDisk   = "system.disk.percent"
	stateUptime = "system.uptime"
)

// Threshold-crossing event topics (under→over transitions only, no spam).
const (
	topicCPUHigh = "system.cpu.high"
	topicRAMHigh = "system.ram.high"
)

// systemStates is the exact set the plugin declares in its register message; the
// host's IPC gate (PROJ-133) only admits stateUpdates for declared IDs, so this
// must match every ID publish() ever emits.
func systemStates() []string {
	return []string{stateCPU, stateRAM, stateNet, stateDisk, stateUptime}
}

// Cadences is how often each metric is polled/published.
type Cadences struct {
	CPU    time.Duration
	RAM    time.Duration
	Net    time.Duration
	Disk   time.Duration
	Uptime time.Duration
}

// DefaultCadences match 2G: fast gauges at 1s, storage at 10s, uptime at 60s.
func DefaultCadences() Cadences {
	return Cadences{
		CPU:    time.Second,
		RAM:    time.Second,
		Net:    time.Second,
		Disk:   10 * time.Second,
		Uptime: 60 * time.Second,
	}
}

// msgWriter serialises concurrent message writes (publish loop + heartbeat) onto a
// single io.Writer (the plugin's stdout).
type msgWriter struct {
	mu sync.Mutex
	w  io.Writer
}

func newMsgWriter(w io.Writer) *msgWriter { return &msgWriter{w: w} }

func (mw *msgWriter) write(m ipcproto.Message) error {
	b, err := ipcproto.Encode(m)
	if err != nil {
		return err
	}
	mw.mu.Lock()
	defer mw.mu.Unlock()
	_, err = mw.w.Write(b)
	return err
}

// metric is one tracked telemetry signal: how to read it, how often, and (for CPU
// and RAM) the threshold whose under→over crossing emits an event.
type metric struct {
	id        string
	cadence   time.Duration
	read      func() (float64, bool)
	warnTopic string  // "" = no threshold
	warnLimit float64 // value strictly above this crosses the threshold
	last      time.Time
	over      bool
}

// Publisher polls a pal.Telemetry provider on per-metric cadences and writes typed
// stateUpdates plus threshold events. It is driven by an external clock via
// PublishDue, which makes cadence/threshold behaviour deterministically testable.
type Publisher struct {
	w       *msgWriter
	metrics []metric
}

// NewPublisher builds a Publisher over the given provider and cadences. cpuWarn and
// ramWarn are the high-usage thresholds (e.g. 85 and 90).
func NewPublisher(t pal.Telemetry, w *msgWriter, c Cadences, cpuWarn, ramWarn float64) *Publisher {
	return &Publisher{
		w: w,
		metrics: []metric{
			{id: stateCPU, cadence: c.CPU, read: t.CPUPercent, warnTopic: topicCPUHigh, warnLimit: cpuWarn},
			{id: stateRAM, cadence: c.RAM, read: t.MemUsedPercent, warnTopic: topicRAMHigh, warnLimit: ramWarn},
			{id: stateNet, cadence: c.Net, read: t.NetThroughput},
			{id: stateDisk, cadence: c.Disk, read: t.DiskUsedPercent},
			{id: stateUptime, cadence: c.Uptime, read: t.UptimeSeconds},
		},
	}
}

// PublishDue polls and publishes every metric whose cadence has elapsed by now.
// Unavailable metrics (ok=false) are skipped without advancing nothing else — the
// cadence clock still advances so an unavailable provider is not retried in a hot
// loop. Returns the first write error encountered.
func (p *Publisher) PublishDue(now time.Time) error {
	for i := range p.metrics {
		m := &p.metrics[i]
		if !m.last.IsZero() && now.Sub(m.last) < m.cadence {
			continue
		}
		m.last = now

		v, ok := m.read()
		if !ok {
			continue
		}
		if err := p.w.write(ipcproto.Message{
			Type:  ipcproto.MsgStateUpdate,
			State: &ipcproto.StatePayload{ID: m.id, Value: v},
		}); err != nil {
			return err
		}

		if m.warnTopic != "" {
			over := v > m.warnLimit
			if over && !m.over { // under→over transition only
				if err := p.emitThreshold(m.warnTopic, m.id, v, m.warnLimit); err != nil {
					return err
				}
			}
			m.over = over
		}
	}
	return nil
}

func (p *Publisher) emitThreshold(topic, metricID string, value, limit float64) error {
	payload, _ := json.Marshal(map[string]any{"metric": metricID, "value": value, "limit": limit})
	return p.w.write(ipcproto.Message{
		Type:  ipcproto.MsgEvent,
		Event: &ipcproto.EventPayload{Topic: topic, Payload: payload},
	})
}
