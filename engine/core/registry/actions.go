// Package registry implements the three schema-driven registries (action,
// widget-type, flow-node) — the keystone that unifies the plugin ecosystem and
// the designer (TRD 2B §3 / ADR-0006). Plugins (first-party and third-party,
// identically) contribute descriptors; the host validates and merges them, and
// the designer reads the schemas to auto-generate its UI. Descriptors are the
// single source of truth that engine and client both validate against.
package registry

import (
	"errors"
	"fmt"
)

// ParamType is an action/flow-node parameter type (2B §3.1, the V1 set).
type ParamType string

const (
	ParamInt      ParamType = "int"
	ParamFloat    ParamType = "float"
	ParamString   ParamType = "string"
	ParamBool     ParamType = "bool"
	ParamChoice   ParamType = "choice"
	ParamColor    ParamType = "color"
	ParamEntity   ParamType = "entity"
	ParamFile     ParamType = "file"
	ParamFolder   ParamType = "folder"
	ParamDuration ParamType = "duration"
)

func (p ParamType) valid() bool {
	switch p {
	case ParamInt, ParamFloat, ParamString, ParamBool, ParamChoice,
		ParamColor, ParamEntity, ParamFile, ParamFolder, ParamDuration:
		return true
	default:
		return false
	}
}

// Param is one action/flow-node parameter descriptor. Min/Max are validated by the
// engine on action receipt (clamp/reject per schema).
type Param struct {
	Name     string    `json:"name"`
	Type     ParamType `json:"type"`
	Min      *float64  `json:"min,omitempty"`
	Max      *float64  `json:"max,omitempty"`
	Choices  []string  `json:"choices,omitempty"`
	Required bool      `json:"required,omitempty"`
}

func (p Param) validate() error {
	if p.Name == "" {
		return errors.New("param: name required")
	}
	if !p.Type.valid() {
		return fmt.Errorf("param %q: unknown type %q", p.Name, p.Type)
	}
	if p.Type == ParamChoice && len(p.Choices) == 0 {
		return fmt.Errorf("param %q: choice type requires non-empty choices", p.Name)
	}
	if p.Min != nil && p.Max != nil && *p.Min > *p.Max {
		return fmt.Errorf("param %q: min (%v) > max (%v)", p.Name, *p.Min, *p.Max)
	}
	return nil
}

// ActionDescriptor describes an invokable action (2B §3.1). category + destructive
// feed the permission model (2E §5 / PROJ-125).
type ActionDescriptor struct {
	ID           string  `json:"id"`
	Label        string  `json:"label"`
	Category     string  `json:"category"`
	Source       string  `json:"source,omitempty"`
	Params       []Param `json:"params,omitempty"`
	Confirmation bool    `json:"confirmation,omitempty"`
	Destructive  bool    `json:"destructive,omitempty"`
	Elevated     bool    `json:"elevated,omitempty"`
}

func (a ActionDescriptor) validate() error {
	if a.ID == "" {
		return errors.New("action: id required")
	}
	if a.Label == "" {
		return fmt.Errorf("action %q: label required", a.ID)
	}
	if a.Category == "" {
		return fmt.Errorf("action %q: category required", a.ID)
	}
	for _, p := range a.Params {
		if err := p.validate(); err != nil {
			return fmt.Errorf("action %q: %w", a.ID, err)
		}
	}
	return nil
}
