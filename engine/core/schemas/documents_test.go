// CD-111: Go twin of ide/src/shared/schemas/documents.test.ts — the
// cyberdeck.project and cyberdeck.layout schemas validate their fixtures.
package schemas_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

func TestDocumentSchemas(t *testing.T) {
	docsDir, err := filepath.Abs(filepath.Join("..", "..", "..", "shared", "schemas", "documents"))
	if err != nil {
		t.Fatal(err)
	}

	for _, doc := range []string{"project", "layout"} {
		t.Run(doc, func(t *testing.T) {
			c := jsonschema.NewCompiler()
			sch, err := c.Compile(filepath.Join(docsDir, doc+".schema.json"))
			if err != nil {
				t.Fatalf("schema does not compile: %v", err)
			}
			entries, err := os.ReadDir(filepath.Join(docsDir, "fixtures", doc))
			if err != nil {
				t.Fatal(err)
			}
			var valid, invalid int
			for _, e := range entries {
				d := loadJSON(t, filepath.Join(docsDir, "fixtures", doc, e.Name()))
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
