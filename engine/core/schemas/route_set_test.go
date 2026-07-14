// CD-114: Go parity — the route set v1 validates against the route-registry
// meta-schema and all 15 event payload schemas compile (the engine emits these
// event payloads and may consume the registry when routing). TS twin:
// ide/src/shared/schemas/route-set.test.ts.
package schemas_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

func TestRouteSetV1(t *testing.T) {
	cpDir, err := filepath.Abs(filepath.Join("..", "..", "..", "shared", "schemas", "control-plane"))
	if err != nil {
		t.Fatal(err)
	}

	c := jsonschema.NewCompiler()
	meta, err := c.Compile(filepath.Join(cpDir, "route-registry.schema.json"))
	if err != nil {
		t.Fatalf("meta-schema does not compile: %v", err)
	}
	registry := loadJSON(t, filepath.Join(cpDir, "routes.v1.json"))
	if err := meta.Validate(registry); err != nil {
		t.Fatalf("routes.v1.json invalid against meta-schema: %v", err)
	}

	// all event payload schemas compile
	eventsDir := filepath.Join(cpDir, "events")
	entries, err := os.ReadDir(eventsDir)
	if err != nil {
		t.Fatal(err)
	}
	var n int
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".schema.json") {
			continue
		}
		n++
		cc := jsonschema.NewCompiler()
		if _, err := cc.Compile(filepath.Join(eventsDir, e.Name())); err != nil {
			t.Errorf("event schema %s does not compile: %v", e.Name(), err)
		}
	}
	if n != 15 {
		t.Errorf("expected 15 event schemas, found %d", n)
	}
}
