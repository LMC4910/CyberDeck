package flow

import (
	"errors"
	"fmt"

	"github.com/shishir/cyberdeck/engine/core/registry"
)

// Sentinel errors so callers/tests can distinguish failures.
var (
	ErrNoTrigger      = errors.New("flow: trigger kind required")
	ErrDuplicateNode  = errors.New("flow: duplicate node id")
	ErrUnknownNode    = errors.New("flow: unknown node kind")
	ErrBadParam       = errors.New("flow: invalid node param")
	ErrDanglingEdge   = errors.New("flow: edge references unknown node")
	ErrEmptyNodeID    = errors.New("flow: node id required")
)

// NodeRegistry is the slice of the registry flow validation needs (the
// *registry.Registry satisfies it; tests can fake it).
type NodeRegistry interface {
	FlowNode(kind string) (registry.FlowNodeDescriptor, bool)
}

// Validate checks a flow against the flow-node registry: every node kind exists,
// its params satisfy the node's schema, node ids are unique, and edges reference
// real nodes. Rejected flows must not be persisted (PROJ-200 AC).
func Validate(reg NodeRegistry, f *Flow) error {
	if f.Trigger.Kind == "" {
		return ErrNoTrigger
	}
	ids := make(map[string]struct{}, len(f.Nodes))
	for _, n := range f.Nodes {
		if n.ID == "" {
			return ErrEmptyNodeID
		}
		if _, dup := ids[n.ID]; dup {
			return fmt.Errorf("%w: %q", ErrDuplicateNode, n.ID)
		}
		ids[n.ID] = struct{}{}

		desc, ok := reg.FlowNode(n.Kind)
		if !ok {
			return fmt.Errorf("%w: %q", ErrUnknownNode, n.Kind)
		}
		if err := validateParams(n, desc.Params); err != nil {
			return err
		}
	}
	for _, e := range f.Edges {
		if _, ok := ids[e.From]; !ok {
			return fmt.Errorf("%w: from %q", ErrDanglingEdge, e.From)
		}
		if _, ok := ids[e.To]; !ok {
			return fmt.Errorf("%w: to %q", ErrDanglingEdge, e.To)
		}
	}
	return nil
}

func validateParams(n Node, schema []registry.Param) error {
	for _, p := range schema {
		v, present := n.Params[p.Name]
		if !present {
			if p.Required {
				return fmt.Errorf("%w: node %q missing required %q", ErrBadParam, n.ID, p.Name)
			}
			continue
		}
		if err := validateParamValue(n.ID, p, v); err != nil {
			return err
		}
	}
	return nil
}

func validateParamValue(nodeID string, p registry.Param, v any) error {
	switch p.Type {
	case registry.ParamInt, registry.ParamFloat, registry.ParamDuration:
		num, ok := asFloat(v)
		if !ok {
			return fmt.Errorf("%w: node %q param %q must be numeric", ErrBadParam, nodeID, p.Name)
		}
		if p.Min != nil && num < *p.Min {
			return fmt.Errorf("%w: node %q param %q below min %v", ErrBadParam, nodeID, p.Name, *p.Min)
		}
		if p.Max != nil && num > *p.Max {
			return fmt.Errorf("%w: node %q param %q above max %v", ErrBadParam, nodeID, p.Name, *p.Max)
		}
	case registry.ParamBool:
		if _, ok := v.(bool); !ok {
			return fmt.Errorf("%w: node %q param %q must be bool", ErrBadParam, nodeID, p.Name)
		}
	case registry.ParamChoice:
		s, ok := v.(string)
		if !ok || !contains(p.Choices, s) {
			return fmt.Errorf("%w: node %q param %q must be one of %v", ErrBadParam, nodeID, p.Name, p.Choices)
		}
	default:
		// string/color/entity/file/folder: accept any string-ish value in V1.
	}
	return nil
}

func asFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}

func contains(xs []string, s string) bool {
	for _, x := range xs {
		if x == s {
			return true
		}
	}
	return false
}
