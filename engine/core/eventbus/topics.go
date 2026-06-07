// Package eventbus is the engine's in-process pub/sub (TRD 2B §4). It decouples
// producers (state changes, plugin/lifecycle events) from consumers (flow
// triggers, audit, fan-out). Delivery is ordered per topic and non-blocking: a
// slow subscriber gets a bounded queue and overflow is dropped+logged rather than
// stalling producers.
package eventbus

// Topic names an event stream.
type Topic string

// The Phase-1 topic taxonomy (2B §4). Publishers may use any Topic; these name
// the well-known ones.
const (
	TopicStateChanged     Topic = "state.changed"
	TopicThresholdCrossed Topic = "threshold.crossed"
	TopicDevicePaired     Topic = "device.paired"
	TopicDeviceRevoked    Topic = "device.revoked"
	TopicPluginStarted    Topic = "plugin.started"
	TopicPluginStopped    Topic = "plugin.stopped"
	TopicPluginCrashed    Topic = "plugin.crashed"
	TopicSessionOpened    Topic = "session.opened"
	TopicSessionClosed    Topic = "session.closed"
	TopicFlowRun          Topic = "flow.run"
	TopicFlowFailed       Topic = "flow.failed"
)

// Event is one published message.
type Event struct {
	Topic   Topic
	Payload any
}
