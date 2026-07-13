// CD-110: Go-side twin of ide/src/shared/schemas/widget-manifest.test.ts —
// canon widget manifests validate against widget-manifest v2, invalid
// fixtures are rejected.
package schemas_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

func TestWidgetManifestV2(t *testing.T) {
	schemasDir, err := filepath.Abs(filepath.Join("..", "..", "..", "shared", "schemas"))
	if err != nil {
		t.Fatal(err)
	}

	c := jsonschema.NewCompiler()
	sch, err := c.Compile(filepath.Join(schemasDir, "widget-manifest.schema.json"))
	if err != nil {
		t.Fatalf("schema does not compile: %v", err)
	}

	widgetsDir := filepath.Join(schemasDir, "widgets")
	entries, err := os.ReadDir(widgetsDir)
	if err != nil {
		t.Fatal(err)
	}

	var canon int
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".manifest.json") {
			continue
		}
		canon++
		doc := loadJSON(t, filepath.Join(widgetsDir, e.Name()))
		if err := sch.Validate(doc); err != nil {
			t.Errorf("canon manifest %s should validate: %v", e.Name(), err)
		}
	}
	if canon != 3 {
		t.Errorf("expected the 3 canon manifests, found %d", canon)
	}

	fixtures, err := os.ReadDir(filepath.Join(widgetsDir, "fixtures"))
	if err != nil {
		t.Fatal(err)
	}
	var invalid int
	for _, e := range fixtures {
		if !strings.HasPrefix(e.Name(), "invalid-") {
			continue
		}
		invalid++
		doc := loadJSON(t, filepath.Join(widgetsDir, "fixtures", e.Name()))
		if err := sch.Validate(doc); err == nil {
			t.Errorf("fixture %s should be rejected but validated", e.Name())
		}
	}
	if invalid < 2 {
		t.Errorf("need >=2 invalid fixtures, got %d", invalid)
	}
}
