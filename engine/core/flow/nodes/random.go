package nodes

import (
	"crypto/rand"
	"math/big"

	"github.com/shishir/cyberdeck/engine/core/flow"
)

// randomNode picks one of params.branches (a list of edge labels) at random and
// returns it. With no branches it follows the "next" edge.
type randomNode struct{ d Deps }

func (r randomNode) Run(_ *flow.RunContext, n flow.Node) (string, error) {
	raw, _ := n.Params["branches"].([]any)
	labels := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok && s != "" {
			labels = append(labels, s)
		}
	}
	if len(labels) == 0 {
		return "next", nil
	}
	pick := r.d.Rand
	if pick == nil {
		pick = cryptoIntn
	}
	return labels[pick(len(labels))], nil
}

// cryptoIntn returns a uniform value in [0,n) using crypto/rand (n>0).
func cryptoIntn(n int) int {
	if n <= 1 {
		return 0
	}
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(v.Int64())
}
