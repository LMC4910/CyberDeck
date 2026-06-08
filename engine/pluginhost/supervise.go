package pluginhost

import "time"

// Supervision: liveness via the IPC heartbeat (2F §4). A plugin that stops sending
// any message for longer than the host's heartbeat timeout is considered hung; the
// monitor signals it via Unhealthy(). PROJ-131 turns that signal into restart/fault
// policy; PROJ-130 just detects.

// Healthy reports whether the plugin has produced traffic within the heartbeat
// timeout.
func (p *Plugin) Healthy() bool {
	last := time.Unix(0, p.lastBeat.Load())
	return time.Since(last) <= p.host.hbTimeout
}

// Unhealthy is closed once the plugin is detected hung (no heartbeat within the
// timeout) or has exited unexpectedly.
func (p *Plugin) Unhealthy() <-chan struct{} { return p.unhealthy }

// monitor watches liveness until the plugin is closed or exits.
func (p *Plugin) monitor() {
	defer p.wg.Done()
	interval := p.host.hbTimeout / 2
	if interval <= 0 {
		interval = p.host.hbTimeout
	}
	t := time.NewTicker(interval)
	defer t.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return // clean shutdown (Close): not a fault
		case <-p.exited:
			// Unexpected exit (not via Close) is a fault worth signalling.
			if p.ctx.Err() == nil {
				p.signalUnhealthy()
			}
			return
		case <-t.C:
			if !p.Healthy() {
				p.signalUnhealthy()
			}
		}
	}
}

func (p *Plugin) signalUnhealthy() {
	p.unhealthyOnce.Do(func() { close(p.unhealthy) })
}
