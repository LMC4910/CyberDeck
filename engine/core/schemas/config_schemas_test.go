// CD-108: Go-side validation of the six config-area schemas + fixtures in
// shared/schemas/config (the TS-side twin lives in ide/src/shared/schemas).
// Uses santhosh-tekuri/jsonschema (draft 2020-12) — the ticket named
// gojsonschema, which tops out at draft-07 and cannot compile these schemas.
package schemas_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

var areas = []string{
	"application",
	"user-prefs",
	"workspace-layout",
	"session",
	"feature-flags",
	"keymap",
}

func configDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.Abs(filepath.Join("..", "..", "..", "shared", "schemas", "config"))
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func loadJSON(t *testing.T, path string) any {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	doc, err := jsonschema.UnmarshalJSON(f)
	if err != nil {
		t.Fatalf("%s: %v", path, err)
	}
	return doc
}

func TestConfigSchemasAndFixtures(t *testing.T) {
	dir := configDir(t)
	for _, area := range areas {
		t.Run(area, func(t *testing.T) {
			c := jsonschema.NewCompiler()
			sch, err := c.Compile(filepath.Join(dir, area+".schema.json"))
			if err != nil {
				t.Fatalf("schema does not compile: %v", err)
			}

			fixtureDir := filepath.Join(dir, "fixtures", area)
			entries, err := os.ReadDir(fixtureDir)
			if err != nil {
				t.Fatal(err)
			}

			var valid, invalid int
			for _, e := range entries {
				doc := loadJSON(t, filepath.Join(fixtureDir, e.Name()))
				err := sch.Validate(doc)
				switch {
				case strings.HasPrefix(e.Name(), "valid-"):
					valid++
					if err != nil {
						t.Errorf("%s should validate: %v", e.Name(), err)
					}
				case strings.HasPrefix(e.Name(), "invalid-"):
					invalid++
					if err == nil {
						t.Errorf("%s should be rejected but validated", e.Name())
					}
				default:
					t.Errorf("fixture %s must be named valid-* or invalid-*", e.Name())
				}
			}
			if valid < 2 || invalid < 2 {
				t.Errorf("need >=2 valid and >=2 invalid fixtures, got %d/%d", valid, invalid)
			}
		})
	}
}
