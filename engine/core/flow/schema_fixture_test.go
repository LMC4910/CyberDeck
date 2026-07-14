// CD-112: the cyberdeck.flow "stream-start" fixture parses 1:1 onto the Go
// flow model — proving the schema (shared/schemas/documents/flow.schema.json)
// and engine model.go do not drift. Companion to the ajv validation in
// ide/src/shared/schemas/documents.test.ts; mapping in FLOW_MAPPING.md.
package flow_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/flow"
)

func TestStreamStartFixtureRoundTrips(t *testing.T) {
	path := filepath.Join("..", "..", "..", "shared", "schemas", "documents",
		"fixtures", "flow", "valid-stream-start.json")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	f, err := flow.ParseFlow(body)
	if err != nil {
		t.Fatalf("ParseFlow: %v", err)
	}

	if f.ID != "flow_strt0001" || f.Label != "Stream Start" || f.Version != 1 {
		t.Errorf("header mismatch: %+v", f)
	}
	if f.Trigger.Kind != flow.TriggerEvent {
		t.Errorf("trigger kind = %q, want event", f.Trigger.Kind)
	}
	if got := f.Trigger.Config["event"]; got != "obs.streaming.started" {
		t.Errorf("trigger config.event = %v", got)
	}
	if len(f.Nodes) != 4 {
		t.Fatalf("nodes = %d, want 4", len(f.Nodes))
	}
	if f.Nodes[0].ID != "cond1" || f.Nodes[0].Kind != "logic.condition" {
		t.Errorf("node[0] = %+v", f.Nodes[0])
	}

	// The schema's edge `branch` serializes to the model's Edge.Label.
	if len(f.Edges) != 4 {
		t.Fatalf("edges = %d, want 4", len(f.Edges))
	}
	branches := map[string]int{}
	for _, e := range f.Edges {
		branches[e.Label]++
	}
	if branches["true"] != 1 || branches["false"] != 1 || branches["always"] != 2 {
		t.Errorf("branch labels = %v, want true:1 false:1 always:2", branches)
	}
}
