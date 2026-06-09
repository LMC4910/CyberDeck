// Package flow owns the flow (automation) document model, its validation against
// the flow-node registry, and its versioned persistence (2D §2/§3). A flow is a
// trigger + a node graph. The model is independent of execution — the executor +
// run context are PROJ-202; the granular op-model (per-edit + undo) is deferred to
// Phase 3 (ADR-0022), so V1 persists whole documents with a monotonic version.
package flow

import (
	"encoding/json"
	"fmt"
)

// Trigger starts a flow (manual / event / stateChange; kinds defined in PROJ-204).
type Trigger struct {
	Kind   string         `json:"kind"`
	Config map[string]any `json:"config,omitempty"`
}

// Node is one step in the flow graph; Kind is validated against the flow-node
// registry (PROJ-161), Params against that node's schema.
type Node struct {
	ID     string         `json:"id"`
	Kind   string         `json:"kind"`
	Params map[string]any `json:"params,omitempty"`
}

// Edge connects nodes; Label distinguishes branches (e.g. "next", "true", "false").
type Edge struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label,omitempty"`
}

// Flow is a persisted automation document.
type Flow struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Version int     `json:"version"`
	Trigger Trigger `json:"trigger"`
	Nodes   []Node  `json:"nodes"`
	Edges   []Edge  `json:"edges"`
}

// ParseFlow decodes a flow document body.
func ParseFlow(body []byte) (*Flow, error) {
	var f Flow
	if err := json.Unmarshal(body, &f); err != nil {
		return nil, fmt.Errorf("flow: parse: %w", err)
	}
	return &f, nil
}

// JSON encodes the flow document body.
func (f *Flow) JSON() ([]byte, error) {
	b, err := json.Marshal(f)
	if err != nil {
		return nil, fmt.Errorf("flow: encode: %w", err)
	}
	return b, nil
}
