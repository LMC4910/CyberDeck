package session

import (
	"context"
	"log"
	"time"

	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// DefaultPumpInterval is how often the pump drains changed state to devices.
const DefaultPumpInterval = 500 * time.Millisecond

// DirtyDrainer yields the states that changed since the last drain (delta
// suppression, PROJ-160). *state.Store satisfies it.
type DirtyDrainer interface {
	DrainDirty() []state.Delta
}

// StatePump periodically drains changed state and fans it to subscribed sessions,
// then flushes their queues. One pump serves all sessions (the fan-out filters per
// device). It satisfies the lifecycle.Service seam structurally.
type StatePump struct {
	drain    DirtyDrainer
	fanout   *transport.Fanout
	interval time.Duration
	logger   *log.Logger

	cancel context.CancelFunc
	done   chan struct{}
}

// NewStatePump builds a pump (interval ≤0 uses the default).
func NewStatePump(drain DirtyDrainer, fanout *transport.Fanout, interval time.Duration, logger *log.Logger) *StatePump {
	if interval <= 0 {
		interval = DefaultPumpInterval
	}
	if logger == nil {
		logger = log.New(log.Writer(), "", log.LstdFlags)
	}
	return &StatePump{drain: drain, fanout: fanout, interval: interval, logger: logger}
}

// Start launches the pump loop.
func (p *StatePump) Start(context.Context) error {
	ctx, cancel := context.WithCancel(context.Background())
	p.cancel = cancel
	p.done = make(chan struct{})
	go p.loop(ctx)
	return nil
}

// Stop halts the pump and waits for the loop to exit. Idempotent.
func (p *StatePump) Stop(context.Context) error {
	if p.cancel != nil {
		p.cancel()
	}
	if p.done != nil {
		<-p.done
	}
	return nil
}

func (p *StatePump) loop(ctx context.Context) {
	defer close(p.done)
	t := time.NewTicker(p.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			p.tick()
		}
	}
}

// tick drains changed state and fans+flushes it. Errors are logged, not fatal.
func (p *StatePump) tick() {
	deltas := p.drain.DrainDirty()
	if len(deltas) == 0 {
		return
	}
	if err := p.fanout.BroadcastState(deltas); err != nil {
		p.logger.Printf("session: broadcast state: %v", err)
	}
	if err := p.fanout.FlushAll(); err != nil {
		p.logger.Printf("session: flush state: %v", err)
	}
}
