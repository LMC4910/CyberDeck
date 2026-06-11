package session

import (
	"context"
	"errors"
	"log"
	"net"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// handshakeTimeout bounds the plaintext handshake so a stalled or hostile peer
// cannot hold a goroutine open indefinitely.
const handshakeTimeout = 10 * time.Second

// Handler serves a freshly paired, encrypted session. The session manager (B1)
// implements it: register the device with the fan-out, push its layout + state, and
// consume its interactions until the session ends.
type Handler interface {
	Serve(sess *transport.EncryptedSession, hr *HandshakeResult)
}

// HandlerFunc adapts a function to Handler.
type HandlerFunc func(sess *transport.EncryptedSession, hr *HandshakeResult)

// Serve calls f.
func (f HandlerFunc) Serve(sess *transport.EncryptedSession, hr *HandshakeResult) { f(sess, hr) }

// Listener is the engine's LAN front door: it accepts TCP connections, runs the
// pairing handshake on each, and hands the resulting encrypted session to the
// Handler. It satisfies the lifecycle.Service seam (Start/Stop) structurally. A
// faulty connection (handshake failure, panic) never affects the listener or other
// connections.
type Listener struct {
	addr    string
	srv     *security.PairingServer
	handler Handler
	logger  *log.Logger

	mu     sync.Mutex
	ln     net.Listener
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewListener builds a listener bound (at Start) to addr (host:port; ":0" picks a
// free port — see Addr).
func NewListener(addr string, srv *security.PairingServer, handler Handler, logger *log.Logger) *Listener {
	if logger == nil {
		logger = log.New(log.Writer(), "", log.LstdFlags)
	}
	return &Listener{addr: addr, srv: srv, handler: handler, logger: logger}
}

// Start binds the socket and launches the accept loop. The accept loop runs on its
// own context so a shutdown signal closes the listener cleanly.
func (l *Listener) Start(context.Context) error {
	ln, err := net.Listen("tcp", l.addr)
	if err != nil {
		return err
	}
	l.mu.Lock()
	l.ln = ln
	l.ctx, l.cancel = context.WithCancel(context.Background())
	l.mu.Unlock()

	l.logger.Printf("transport: listening on %s", ln.Addr())
	l.wg.Add(1)
	go l.acceptLoop()
	return nil
}

// Stop closes the listener and waits for the accept loop + in-flight handshakes to
// finish. Idempotent.
func (l *Listener) Stop(context.Context) error {
	l.mu.Lock()
	cancel, ln := l.cancel, l.ln
	l.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if ln != nil {
		_ = ln.Close()
	}
	l.wg.Wait()
	return nil
}

// Addr returns the actual bound address (useful when addr used ":0"). Empty before
// Start.
func (l *Listener) Addr() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.ln == nil {
		return ""
	}
	return l.ln.Addr().String()
}

func (l *Listener) acceptLoop() {
	defer l.wg.Done()
	for {
		conn, err := l.ln.Accept()
		if err != nil {
			select {
			case <-l.ctx.Done():
				return // expected on Stop
			default:
			}
			if errors.Is(err, net.ErrClosed) {
				return
			}
			l.logger.Printf("transport: accept error: %v", err)
			return
		}
		l.wg.Add(1)
		go l.handleConn(conn)
	}
}

// handleConn runs the handshake and hands off the session. A panic here is recovered
// so one bad connection never crashes the engine (NFR-07).
func (l *Listener) handleConn(conn net.Conn) {
	defer l.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			l.logger.Printf("transport: connection handler panic from %s: %v", conn.RemoteAddr(), r)
			_ = conn.Close()
		}
	}()

	// Bound the handshake with a deadline; clear it before the long-lived session.
	_ = conn.SetDeadline(time.Now().Add(handshakeTimeout))
	hsCtx, cancel := context.WithTimeout(l.ctx, handshakeTimeout)
	defer cancel()

	hr, err := ServerHandshake(hsCtx, conn, l.srv)
	if err != nil {
		l.logger.Printf("transport: handshake from %s failed: %v", conn.RemoteAddr(), err)
		_ = conn.Close()
		return
	}
	_ = conn.SetDeadline(time.Time{}) // no deadline for the session

	sess, err := transport.NewEncryptedSession(conn, hr.Keys, false, hr.DeviceUUID)
	if err != nil {
		l.logger.Printf("transport: open session for %s failed: %v", hr.DeviceUUID, err)
		_ = conn.Close()
		return
	}
	l.logger.Printf("transport: device %s paired and connected from %s", hr.DeviceUUID, conn.RemoteAddr())
	l.handler.Serve(sess, hr)
}
