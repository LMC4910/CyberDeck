package lifecycle

import (
	"errors"
	"hash/fnv"
	"net"
	"sync"
	"time"
)

// Single-instance guard (PROJ-105). The engine must refuse a second instance and
// the second launch must signal the first to focus its UI. The lock is a small
// listening socket whose address is derived from an instance name; the OS-specific
// address + stale-cleanup live in singleinstance_{linux,darwin,windows}.go:
//
//   - linux:   abstract unix socket (kernel auto-reclaims, no stale files)
//   - darwin:  unix socket file in TMPDIR (unlinked on release / stale cleanup)
//   - windows: loopback TCP on a deterministic high port
//
// Holding the listener IS the lock; a second launch fails to bind, dials the
// running instance to deliver a focus request, and reports ErrAlreadyRunning.

// ErrAlreadyRunning means another engine instance already holds the lock.
var ErrAlreadyRunning = errors.New("lifecycle: another engine instance is already running")

// InstanceLock is ownership of the single-instance slot; Release frees it.
type InstanceLock interface {
	Release() error
}

type instanceGuard struct {
	ln        net.Listener
	done      chan struct{}
	closeOnce sync.Once
}

// AcquireInstance claims the single-instance slot named name. If another instance
// holds it, AcquireInstance signals that instance to focus its UI and returns
// ErrAlreadyRunning. Otherwise it returns a lock to Release at shutdown; onFocus
// (may be nil) is invoked once per later launch that asks this instance to focus.
func AcquireInstance(name string, onFocus func()) (InstanceLock, error) {
	network, addr := instanceEndpoint(name)

	ln, err := net.Listen(network, addr)
	if err != nil {
		// Bind failed. If the address is live, a real instance owns it.
		if c, derr := net.DialTimeout(network, addr, 500*time.Millisecond); derr == nil {
			_, _ = c.Write([]byte("focus\n"))
			_ = c.Close()
			return nil, ErrAlreadyRunning
		}
		// Not dialable → likely a stale socket from a crashed instance. Clean and
		// retry once.
		if cerr := removeStale(addr); cerr != nil {
			return nil, cerr
		}
		ln, err = net.Listen(network, addr)
		if err != nil {
			return nil, err
		}
	}

	g := &instanceGuard{ln: ln, done: make(chan struct{})}
	go g.serve(onFocus)
	return g, nil
}

func (g *instanceGuard) serve(onFocus func()) {
	for {
		conn, err := g.ln.Accept()
		if err != nil {
			return // listener closed (Release) or fatal accept error
		}
		_ = conn.Close()
		select {
		case <-g.done:
			return
		default:
		}
		if onFocus != nil {
			onFocus()
		}
	}
}

func (g *instanceGuard) Release() error {
	g.closeOnce.Do(func() { close(g.done) })
	return g.ln.Close()
}

// nameHash is a stable 32-bit hash of an instance name, used by the per-OS
// endpoints to derive a socket suffix / port deterministically.
func nameHash(name string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(name))
	return h.Sum32()
}
