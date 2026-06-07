package registry

import (
	"errors"
	"fmt"
)

// FlowNodeDescriptor describes a flow-node type (2B §3.3). ExecHandle is the
// opaque handle into the flow executor's execution contract (2D / PROJ-202).
type FlowNodeDescriptor struct {
	Kind       string  `json:"kind"`
	Label      string  `json:"label"`
	Source     string  `json:"source,omitempty"`
	Params     []Param `json:"params,omitempty"`
	ExecHandle string  `json:"execHandle"`
}

func (f FlowNodeDescriptor) validate() error {
	if f.Kind == "" {
		return errors.New("flow-node: kind required")
	}
	if f.Label == "" {
		return fmt.Errorf("flow-node %q: label required", f.Kind)
	}
	if f.ExecHandle == "" {
		return fmt.Errorf("flow-node %q: execHandle required", f.Kind)
	}
	for _, p := range f.Params {
		if err := p.validate(); err != nil {
			return fmt.Errorf("flow-node %q: %w", f.Kind, err)
		}
	}
	return nil
}
