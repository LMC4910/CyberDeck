package pluginhost

import "github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"

// The IPC protocol lives in the dependency-free ipcproto package so plugin
// binaries (separate modules) can import it without the engine's heavier deps.
// The host re-exports the types here as aliases for ergonomic in-package use.

type (
	MsgType             = ipcproto.MsgType
	Message             = ipcproto.Message
	InitPayload         = ipcproto.InitPayload
	RegisterPayload     = ipcproto.RegisterPayload
	StatePayload        = ipcproto.StatePayload
	EventPayload        = ipcproto.EventPayload
	ActionPayload       = ipcproto.ActionPayload
	ActionResultPayload = ipcproto.ActionResultPayload
	LogPayload          = ipcproto.LogPayload
)

const (
	MsgInit             = ipcproto.MsgInit
	MsgRegister         = ipcproto.MsgRegister
	MsgStateUpdate      = ipcproto.MsgStateUpdate
	MsgEvent            = ipcproto.MsgEvent
	MsgInvokeAction     = ipcproto.MsgInvokeAction
	MsgActionResult     = ipcproto.MsgActionResult
	MsgQueryCapability  = ipcproto.MsgQueryCapability
	MsgCapabilityResult = ipcproto.MsgCapabilityResult
	MsgHeartbeat        = ipcproto.MsgHeartbeat
	MsgLog              = ipcproto.MsgLog
)

// encodeMessage serializes a message as a single newline-terminated JSON line.
func encodeMessage(m Message) ([]byte, error) { return ipcproto.Encode(m) }
