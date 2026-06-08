package pluginhost

import (
	"context"
	"errors"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/registry"
)

const validManifest = `{
  "id": "com.shishir.cyberdeck.telemetry",
  "name": "Telemetry",
  "apiVersion": "1.0",
  "permissions": {"categories": ["system"], "network": "none", "filesystem": "none"},
  "contributes": {
    "actions": [{"id": "system.refresh", "label": "Refresh", "category": "system"}],
    "widgets": [{"type": "gauge.circular", "label": "Gauge", "acceptsStateKinds": ["scalar"]}],
    "flowNodes": [{"kind": "delay", "label": "Delay", "execHandle": "core.delay"}]
  }
}`

func TestMergeValidManifest(t *testing.T) {
	ctx := context.Background()
	reg := registry.New()
	m, err := ParseManifest([]byte(validManifest))
	if err != nil {
		t.Fatalf("ParseManifest: %v", err)
	}
	perms, err := MergeManifest(ctx, reg, m)
	if err != nil {
		t.Fatalf("MergeManifest: %v", err)
	}
	if len(perms.Categories) != 1 || perms.Categories[0] != "system" {
		t.Errorf("declared permissions not returned: %+v", perms)
	}
	// Contributions are queryable in the registry (backing P1-AC-10).
	if _, ok := reg.Action("system.refresh"); !ok {
		t.Error("action not merged into registry")
	}
	if _, ok := reg.Widget("gauge.circular"); !ok {
		t.Error("widget not merged into registry")
	}
	if _, ok := reg.FlowNode("delay"); !ok {
		t.Error("flow-node not merged into registry")
	}
}

func TestAPIVersionRefused(t *testing.T) {
	ctx := context.Background()
	reg := registry.New()
	m, err := ParseManifest([]byte(`{"id":"p","name":"P","apiVersion":"2.0",
		"contributes":{"actions":[{"id":"a","label":"A","category":"c"}]}}`))
	if err != nil {
		t.Fatalf("ParseManifest: %v", err)
	}
	if _, err := MergeManifest(ctx, reg, m); !errors.Is(err, ErrIncompatibleAPIVersion) {
		t.Errorf("MergeManifest = %v, want ErrIncompatibleAPIVersion", err)
	}
	// Nothing merged on refusal.
	if _, ok := reg.Action("a"); ok {
		t.Error("action merged despite apiVersion refusal")
	}
}

func TestManifestCollisionRejected(t *testing.T) {
	ctx := context.Background()
	reg := registry.New()
	mA, _ := ParseManifest([]byte(`{"id":"plugin.a","name":"A","apiVersion":"1.0",
		"contributes":{"actions":[{"id":"shared.action","label":"X","category":"c"}]}}`))
	if _, err := MergeManifest(ctx, reg, mA); err != nil {
		t.Fatalf("merge A: %v", err)
	}
	mB, _ := ParseManifest([]byte(`{"id":"plugin.b","name":"B","apiVersion":"1.0",
		"contributes":{"actions":[{"id":"shared.action","label":"Y","category":"c"}]}}`))
	if _, err := MergeManifest(ctx, reg, mB); err == nil {
		t.Error("colliding action id across plugins was not rejected")
	}
}

func TestMalformedAndInvalidManifest(t *testing.T) {
	bad := []string{
		`{ not json`,
		`{"name":"P","apiVersion":"1.0"}`, // no id
		`{"id":"p","apiVersion":"1.0"}`,   // no name
		`{"id":"p","name":"P"}`,           // no apiVersion
		`{"id":"p","name":"P","apiVersion":"1.0","permissions":{"network":"evil"}}`, // bad perm enum
	}
	for i, s := range bad {
		if _, err := ParseManifest([]byte(s)); err == nil {
			t.Errorf("case %d: expected parse/validate error", i)
		}
	}
}
