package transport

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"sync"
	"time"
)

// Loopback privileged control channel (PROJ-144 / 2A §6 / ADR-0011). The Desktop
// UI and local console drive privileged engine operations — service lifecycle
// (pause/quit/status), pairing approval + single-use token issuance, and audit
// reads — over a channel that is NOT network-routable. Two independent guards
// enforce that:
//
//  1. The listener binds to the loopback interface (127.0.0.1) only, so it is not
//     reachable from the LAN at the socket level; and
//  2. Every accepted connection's remote address is re-checked and a non-loopback
//     peer is refused before any control op runs (defence in depth — a misconfig,
//     a forwarded socket, or a future bind change can never expose control ops).
//
// Crucially, control ops are wired ONLY to this loopback listener. The encrypted
// LAN session path (EncryptedSession → ChannelMux) demuxes a ChannelControl
// envelope into ChannelMux.ControlInbound(), but nothing on the LAN side is wired
// to a ControlHandler — a LAN device can emit a "control" envelope and it goes
// nowhere privileged. Token issuance additionally refuses any non-privileged
// caller at the security layer (PROJ-124). This is the privileged-local boundary
// (2E §3.1): a LAN session can never reach a control op.

// ControlOp is the privileged control message type (the inner "type" of a
// ChannelControl envelope).
type ControlOp string

const (
	// Service lifecycle (2A §6).
	OpServiceStatus ControlOp = "service.status" // report run state
	OpServicePause  ControlOp = "service.pause"  // pause session serving
	OpServiceResume ControlOp = "service.resume" // resume after pause
	OpServiceQuit   ControlOp = "service.quit"   // request graceful shutdown

	// Pairing approval + token issuance (2E §3.1).
	OpPairApprove ControlOp = "pair.approve" // mint a single-use pairing token

	// Audit read (2E §6).
	OpAuditRead ControlOp = "audit.read" // read back audit rows
)

// ErrNonLoopback is returned when a non-loopback peer reaches the control channel.
var ErrNonLoopback = errors.New("transport: control channel refuses non-loopback peer")

// LifecycleController is the slice of the engine's run-state the control channel
// drives (pause/resume/quit/status). The wiring layer (PROJ-105) adapts the
// lifecycle supervisor to it, keeping this package free of lifecycle internals.
type LifecycleController interface {
	// Status reports a short, human-readable run state (e.g. "running", "paused").
	Status(ctx context.Context) (string, error)
	// Pause stops serving new/in-flight sessions without exiting.
	Pause(ctx context.Context) error
	// Resume undoes Pause.
	Resume(ctx context.Context) error
	// Quit requests a graceful shutdown of the engine.
	Quit(ctx context.Context) error
}

// TokenMinter mints a single-use pairing token. *security.TokenIssuer satisfies it
// (Issue(privileged bool)); the control channel always calls it as the privileged
// local caller. Expressed as an interface so this package does not import security.
type TokenMinter interface {
	Issue(privileged bool) (string, error)
}

// AuditRow is a single audit record returned over the control channel. It mirrors
// the persistence audit row in primitive terms so this package does not import
// persistence.
type AuditRow struct {
	ID           int64  `json:"id"`
	TS           int64  `json:"ts"`
	Actor        string `json:"actor"`
	EventType    string `json:"eventType"`
	ResourceType string `json:"resourceType"`
	ResourceID   string `json:"resourceId"`
	PayloadJSON  string `json:"payloadJson"`
}

// AuditReader reads back audit rows for the control channel. The wiring layer
// adapts persistence.AuditRepo to it.
type AuditReader interface {
	// Recent returns the most recent rows (newest first), bounded by limit.
	Recent(ctx context.Context, limit int) ([]AuditRow, error)
}

// AuditReadRequest is the inner payload of an OpAuditRead message.
type AuditReadRequest struct {
	Limit int `json:"limit"`
}

// AuditReadResult is the response payload for OpAuditRead.
type AuditReadResult struct {
	Rows []AuditRow `json:"rows"`
}

// PairApproveResult is the response payload for OpPairApprove: the freshly minted
// single-use token.
type PairApproveResult struct {
	Token string `json:"token"`
}

// StatusResult is the response payload for OpServiceStatus.
type StatusResult struct {
	State string `json:"state"`
}

// controlReply is the envelope-payload wrapper for every control response: either
// an op-specific result (Data) or an error string.
type controlReply struct {
	OK    bool            `json:"ok"`
	Error string          `json:"error,omitempty"`
	Data  json.RawMessage `json:"data,omitempty"`
}

// defaultAuditReadLimit bounds an audit read whose request omits (or over-asks) a
// limit, so a single read can never pull the whole log.
const (
	defaultAuditReadLimit = 100
	maxAuditReadLimit     = 1000
)

// controlHandshakeTimeout bounds a single request/response exchange so a stalled
// local peer cannot pin a goroutine open. Each request resets the deadline.
const controlExchangeTimeout = 10 * time.Second

// ControlHandler executes a decoded control op and returns the response payload
// bytes (the inner data for controlReply.Data). It is the unit the listener
// dispatches to; tests exercise it directly.
type ControlHandler struct {
	life  LifecycleController
	token TokenMinter
	audit AuditReader
}

// NewControlHandler builds a control handler over its privileged dependencies. Any
// dependency may be nil; an op whose dependency is absent is reported as an error
// rather than panicking (a minimal deployment can omit, e.g., audit read).
func NewControlHandler(life LifecycleController, token TokenMinter, audit AuditReader) *ControlHandler {
	return &ControlHandler{life: life, token: token, audit: audit}
}

// Handle dispatches one control op. payload is the inner op-specific request bytes
// (may be nil for ops without a request body). It returns the response data bytes.
func (h *ControlHandler) Handle(ctx context.Context, op ControlOp, payload []byte) ([]byte, error) {
	switch op {
	case OpServiceStatus:
		if h.life == nil {
			return nil, errors.New("transport: no lifecycle controller")
		}
		state, err := h.life.Status(ctx)
		if err != nil {
			return nil, err
		}
		return json.Marshal(StatusResult{State: state})

	case OpServicePause:
		if h.life == nil {
			return nil, errors.New("transport: no lifecycle controller")
		}
		return nil, h.life.Pause(ctx)

	case OpServiceResume:
		if h.life == nil {
			return nil, errors.New("transport: no lifecycle controller")
		}
		return nil, h.life.Resume(ctx)

	case OpServiceQuit:
		if h.life == nil {
			return nil, errors.New("transport: no lifecycle controller")
		}
		return nil, h.life.Quit(ctx)

	case OpPairApprove:
		if h.token == nil {
			return nil, errors.New("transport: no token minter")
		}
		// Always the privileged local caller — this op only ever runs behind the
		// loopback guard.
		tok, err := h.token.Issue(true)
		if err != nil {
			return nil, err
		}
		return json.Marshal(PairApproveResult{Token: tok})

	case OpAuditRead:
		if h.audit == nil {
			return nil, errors.New("transport: no audit reader")
		}
		limit := defaultAuditReadLimit
		if len(payload) > 0 {
			var req AuditReadRequest
			if err := json.Unmarshal(payload, &req); err != nil {
				return nil, fmt.Errorf("transport: decode audit read: %w", err)
			}
			if req.Limit > 0 {
				limit = req.Limit
			}
		}
		if limit > maxAuditReadLimit {
			limit = maxAuditReadLimit
		}
		rows, err := h.audit.Recent(ctx, limit)
		if err != nil {
			return nil, err
		}
		return json.Marshal(AuditReadResult{Rows: rows})

	default:
		return nil, fmt.Errorf("transport: unknown control op %q", op)
	}
}

// ControlChannel is the loopback-only privileged listener. It satisfies the
// lifecycle.Service seam (Start/Stop) structurally so the boot sequence can run it
// like the other front doors, without coupling this package to lifecycle.
type ControlChannel struct {
	addr    string
	handler *ControlHandler
	logger  *log.Logger
	ser     Serializer
	framer  *Framer

	mu     sync.Mutex
	ln     net.Listener
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// DefaultControlAddr is the loopback address the control channel binds to when the
// caller passes an empty addr. Port 0 picks a free port (read it back via Addr).
const DefaultControlAddr = "127.0.0.1:0"

// NewControlChannel builds the loopback control listener. An empty addr binds to
// DefaultControlAddr. The addr MUST resolve to a loopback host; a non-loopback
// bind is rejected at Start.
func NewControlChannel(addr string, handler *ControlHandler, logger *log.Logger) *ControlChannel {
	if addr == "" {
		addr = DefaultControlAddr
	}
	if logger == nil {
		logger = log.New(log.Writer(), "", log.LstdFlags)
	}
	return &ControlChannel{
		addr:    addr,
		handler: handler,
		logger:  logger,
		ser:     JSONSerializer{},
		framer:  NewFramer(0),
	}
}

// Start binds the loopback socket and launches the accept loop. It refuses to bind
// a non-loopback host, so the control channel can never be made network-routable
// by a bad addr.
func (c *ControlChannel) Start(context.Context) error {
	if err := requireLoopbackHost(c.addr); err != nil {
		return err
	}
	ln, err := net.Listen("tcp", c.addr)
	if err != nil {
		return fmt.Errorf("transport: control listen %s: %w", c.addr, err)
	}
	c.mu.Lock()
	c.ln = ln
	c.ctx, c.cancel = context.WithCancel(context.Background())
	c.mu.Unlock()

	c.logger.Printf("transport: control channel listening on %s (loopback only)", ln.Addr())
	c.wg.Add(1)
	go c.acceptLoop()
	return nil
}

// Stop closes the listener and waits for in-flight connections to drain.
// Idempotent.
func (c *ControlChannel) Stop(context.Context) error {
	c.mu.Lock()
	cancel, ln := c.cancel, c.ln
	c.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if ln != nil {
		_ = ln.Close()
	}
	c.wg.Wait()
	return nil
}

// Addr returns the bound address (useful when the port was 0). Empty before Start.
func (c *ControlChannel) Addr() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ln == nil {
		return ""
	}
	return c.ln.Addr().String()
}

func (c *ControlChannel) acceptLoop() {
	defer c.wg.Done()
	for {
		conn, err := c.ln.Accept()
		if err != nil {
			select {
			case <-c.ctx.Done():
				return // expected on Stop
			default:
			}
			if errors.Is(err, net.ErrClosed) {
				return
			}
			c.logger.Printf("transport: control accept error: %v", err)
			return
		}
		c.wg.Add(1)
		go c.handleConn(conn)
	}
}

// handleConn serves one loopback control connection. The peer is re-checked for
// loopback (guard #2) and a non-loopback peer is refused before any op runs. A
// panic is recovered so one bad connection never crashes the engine (NFR-07).
func (c *ControlChannel) handleConn(conn net.Conn) {
	defer c.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			c.logger.Printf("transport: control handler panic from %s: %v", conn.RemoteAddr(), r)
		}
		_ = conn.Close()
	}()

	if !isLoopbackAddr(conn.RemoteAddr()) {
		c.logger.Printf("transport: control channel refused non-loopback peer %s", conn.RemoteAddr())
		return // refuse silently — no privileged surface for a non-loopback peer
	}

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}
		_ = conn.SetDeadline(time.Now().Add(controlExchangeTimeout))

		frame, err := c.framer.Read(conn)
		if err != nil {
			return // EOF on clean close, or read error
		}
		reply := c.serve(frame)
		out, err := c.ser.Marshal(reply)
		if err != nil {
			c.logger.Printf("transport: control marshal reply: %v", err)
			return
		}
		if err := c.framer.Write(conn, out); err != nil {
			return
		}
	}
}

// serve decodes one request envelope, dispatches it, and builds the reply
// envelope. A decode/handle error becomes an error reply (the connection stays
// open for the next request).
func (c *ControlChannel) serve(frame []byte) Envelope {
	req, err := c.ser.Unmarshal(frame)
	if err != nil {
		return c.replyEnvelope("", controlReply{OK: false, Error: "bad request envelope"})
	}
	if req.Ch != ChannelControl {
		return c.replyEnvelope(req.Type, controlReply{OK: false, Error: "not a control-channel message"})
	}
	data, err := c.handler.Handle(context.Background(), ControlOp(req.Type), req.Payload)
	if err != nil {
		return c.replyEnvelope(req.Type, controlReply{OK: false, Error: err.Error()})
	}
	return c.replyEnvelope(req.Type, controlReply{OK: true, Data: json.RawMessage(data)})
}

func (c *ControlChannel) replyEnvelope(replyType string, r controlReply) Envelope {
	b, err := json.Marshal(r)
	if err != nil {
		b, _ = json.Marshal(controlReply{OK: false, Error: "reply encode error"})
	}
	return Envelope{
		V:       ProtocolVersion,
		Ch:      ChannelControl,
		Type:    replyType,
		TS:      time.Now().UnixMilli(),
		Payload: b,
	}
}

// requireLoopbackHost rejects a bind address whose host is not loopback, so the
// control channel can never be configured onto a network-routable interface.
func requireLoopbackHost(addr string) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("transport: control addr %q: %w", addr, err)
	}
	if host == "" {
		return fmt.Errorf("%w: empty host (would bind all interfaces)", ErrNonLoopback)
	}
	if ip := net.ParseIP(host); ip != nil {
		if !ip.IsLoopback() {
			return fmt.Errorf("%w: %s", ErrNonLoopback, host)
		}
		return nil
	}
	// A hostname (e.g. "localhost") must resolve to loopback addresses only.
	ips, err := net.LookupIP(host)
	if err != nil || len(ips) == 0 {
		return fmt.Errorf("%w: cannot resolve %q to loopback", ErrNonLoopback, host)
	}
	for _, ip := range ips {
		if !ip.IsLoopback() {
			return fmt.Errorf("%w: %s resolves to non-loopback %s", ErrNonLoopback, host, ip)
		}
	}
	return nil
}

// isLoopbackAddr reports whether a peer address is on the loopback interface.
func isLoopbackAddr(addr net.Addr) bool {
	host := addr.String()
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// ClientRequest builds a control-channel request envelope for op with an optional
// inner payload. It is the encoder a local control client (Desktop UI / console)
// uses; tests use it too.
func ClientRequest(op ControlOp, payload []byte) Envelope {
	return Envelope{
		V:       ProtocolVersion,
		Ch:      ChannelControl,
		Type:    string(op),
		TS:      time.Now().UnixMilli(),
		Payload: payload,
	}
}

// DecodeReply extracts the controlReply fields from a response envelope: ok, the
// inner data bytes, and any error string. It is the decoder a control client uses.
func DecodeReply(env Envelope) (ok bool, data []byte, errMsg string, err error) {
	var r controlReply
	if e := json.Unmarshal(env.Payload, &r); e != nil {
		return false, nil, "", fmt.Errorf("transport: decode control reply: %w", e)
	}
	return r.OK, r.Data, r.Error, nil
}
