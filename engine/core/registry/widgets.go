package registry

import (
	"errors"
	"fmt"
)

// ConfigField is one widget configuration option (2B §3.2). Default is the
// presentation default the designer offers.
type ConfigField struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Default any    `json:"default,omitempty"`
}

func (c ConfigField) validate() error {
	if c.Name == "" {
		return errors.New("widget config field: name required")
	}
	if c.Type == "" {
		return fmt.Errorf("widget config field %q: type required", c.Name)
	}
	return nil
}

// WidgetDescriptor describes a widget type (2B §3.2). acceptsStateKinds lets the
// designer offer only compatible states when binding; gestures declares which
// interaction slots the type exposes.
type WidgetDescriptor struct {
	Type              string        `json:"type"`
	Label             string        `json:"label"`
	Source            string        `json:"source,omitempty"`
	AcceptsStateKinds []string      `json:"acceptsStateKinds,omitempty"`
	ConfigSchema      []ConfigField `json:"configSchema,omitempty"`
	Gestures          []string      `json:"gestures,omitempty"`
}

func (w WidgetDescriptor) validate() error {
	if w.Type == "" {
		return errors.New("widget: type required")
	}
	if w.Label == "" {
		return fmt.Errorf("widget %q: label required", w.Type)
	}
	for _, f := range w.ConfigSchema {
		if err := f.validate(); err != nil {
			return fmt.Errorf("widget %q: %w", w.Type, err)
		}
	}
	return nil
}

// acceptsKind reports whether the widget can bind a state of the given kind.
func (w WidgetDescriptor) acceptsKind(kind string) bool {
	for _, k := range w.AcceptsStateKinds {
		if k == kind {
			return true
		}
	}
	return false
}
