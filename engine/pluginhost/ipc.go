package pluginhost

import "encoding/json"

// Plugin IPC (2F §5.2). Host↔plugin messages are newline-delimited JSON over the
// plugin's stdio (loopback, same-machine). JSON strings escape newlines, so a
// compact JSON object is always a single line — newline framing is safe. The same
// envelope discipline as the network transport, but host↔plugin.

// MsgType enumerates the IPC message kinds.
type MsgType string

const (
	MsgInit             MsgType = "init"             // host→plugin: config slice + granted perms
	MsgRegister         MsgType = "register"         // plugin→host: declared contributions
	MsgStateUpdate      MsgType = "stateUpdate"      // plugin→host: a state value
	MsgEvent            MsgType = "event"            // plugin→host: an event
	MsgInvokeAction     MsgType = "invokeAction"     // host→plugin: run an action
	MsgActionResult     MsgType = "actionResult"     // plugin→host: action outcome
	MsgQueryCapability  MsgType = "queryCapability"  // host→plugin
	MsgCapabilityResult MsgType = "capabilityResult" // plugin→host
	MsgHeartbeat        MsgType = "heartbeat"        // plugin→host liveness
	MsgLog              MsgType = "log"              // plugin→host structured log
)

// Message is one IPC message. Only the field matching Type is populated.
type Message struct {
	Type         MsgType              `json:"type"`
	Init         *InitPayload         `json:"init,omitempty"`
	Register     *RegisterPayload     `json:"register,omitempty"`
	State        *StatePayload        `json:"state,omitempty"`
	Event        *EventPayload        `json:"event,omitempty"`
	Action       *ActionPayload       `json:"action,omitempty"`
	ActionResult *ActionResultPayload `json:"actionResult,omitempty"`
	Log          *LogPayload          `json:"log,omitempty"`
}

// InitPayload is the host's init: a config slice + the permissions granted to the
// plugin (the plugin must self-enforce; the host re-enforces in PROJ-133).
type InitPayload struct {
	Config       json.RawMessage `json:"config,omitempty"`
	GrantedPerms []string        `json:"grantedPerms,omitempty"`
}

// RegisterPayload declares the plugin's contributions.
type RegisterPayload struct {
	States      []string        `json:"states,omitempty"`
	Contributes json.RawMessage `json:"contributes,omitempty"` // action/widget/flow-node descriptors (merged by PROJ-132)
}

// StatePayload is a single state value publish.
type StatePayload struct {
	ID    string `json:"id"`
	Value any    `json:"value"`
}

// EventPayload is a plugin-emitted event.
type EventPayload struct {
	Topic   string          `json:"topic"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ActionPayload is an action invocation request.
type ActionPayload struct {
	CallID   string          `json:"callId"`
	ActionID string          `json:"actionId"`
	Params   json.RawMessage `json:"params,omitempty"`
}

// ActionResultPayload is an action outcome.
type ActionResultPayload struct {
	CallID string `json:"callId"`
	OK     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
}

// LogPayload is a structured log line (secrets pre-redacted by the plugin).
type LogPayload struct {
	Level string `json:"level"`
	Msg   string `json:"msg"`
}

// encodeMessage serializes a message as a single newline-terminated JSON line.
func encodeMessage(m Message) ([]byte, error) {
	b, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return append(b, '\n'), nil
}
