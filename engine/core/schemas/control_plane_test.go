// CD-113: Go twin of ide/src/shared/schemas/control-plane.test.ts — the
// control-plane envelope, error model and route-registry validate fixtures.
// The envelope $refs the error schema, added as a resource before compile.
package schemas_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

func TestControlPlaneSchemas(t *testing.T) {
	cpDir, err := filepath.Abs(filepath.Join("..", "..", "..", "shared", "schemas", "control-plane"))
	if err != nil {
		t.Fatal(err)
	}

	errID := "https://cyberdeck.shishir.com/schemas/control-plane/error.schema.json"
	errDoc := loadJSON(t, filepath.Join(cpDir, "error.schema.json"))

	for _, name := range []string{"envelope", "error", "route-registry"} {
		t.Run(name, func(t *testing.T) {
			c := jsonschema.NewCompiler()
			// register the error schema so envelope's $ref resolves
			if err := c.AddResource(errID, errDoc); err != nil {
				t.Fatal(err)
			}
			sch, err := c.Compile(filepath.Join(cpDir, name+".schema.json"))
			if err != nil {
				t.Fatalf("schema does not compile: %v", err)
			}
			entries, err := os.ReadDir(filepath.Join(cpDir, "fixtures", name))
			if err != nil {
				t.Fatal(err)
			}
			var valid, invalid int
			for _, e := range entries {
				d := loadJSON(t, filepath.Join(cpDir, "fixtures", name, e.Name()))
				err := sch.Validate(d)
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
				}
			}
			if valid < 2 || invalid < 2 {
				t.Errorf("need >=2 valid and >=2 invalid fixtures, got %d/%d", valid, invalid)
			}
		})
	}
}
