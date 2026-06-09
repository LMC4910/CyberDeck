package nodes

import (
	"context"
	"time"

	"github.com/shishir/cyberdeck/engine/core/flow"
)

// waitNode delays for params.ms milliseconds, cancellable via the run context (a
// cancelled run returns the context error promptly). params:{ms}.
type waitNode struct{ d Deps }

func (w waitNode) Run(rc *flow.RunContext, n flow.Node) (string, error) {
	ms, _ := floatParam(n, "ms")
	d := time.Duration(ms) * time.Millisecond
	sleep := w.d.Sleep
	if sleep == nil {
		sleep = cancellableSleep
	}
	if err := sleep(rc.Ctx, d); err != nil {
		return "", err
	}
	return "next", nil
}

// cancellableSleep waits for d or until the context is done (whichever first).
func cancellableSleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
