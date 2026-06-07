package secrets

import "testing"

func TestContainsSecretDetection(t *testing.T) {
	type plain struct {
		Name string
		N    int
	}
	type withSecret struct {
		Name string
		Key  Secret
	}
	type nestedPtr struct {
		Inner *withSecret
	}
	type nestedSlice struct {
		Items []withSecret
	}
	type nestedMap struct {
		M map[string]Secret
	}

	cases := []struct {
		name string
		v    any
		want bool
	}{
		{"plain struct", plain{}, false},
		{"direct secret field", withSecret{}, true},
		{"pointer to secret-bearing struct", nestedPtr{}, true},
		{"slice of secret-bearing struct", nestedSlice{}, true},
		{"map with secret value", nestedMap{}, true},
		{"bare secret", Secret{}, true},
		{"string", "hello", false},
		{"nil", nil, false},
	}
	for _, c := range cases {
		if got := ContainsSecret(c.v); got != c.want {
			t.Errorf("%s: ContainsSecret = %v, want %v", c.name, got, c.want)
		}
	}
}

// TestRedactionHelper confirms the redaction surface produces [REDACTED].
func TestRedactionHelper(t *testing.T) {
	s := NewString("private-key-bytes")
	if s.String() != Redacted {
		t.Errorf("String() = %q, want %q", s.String(), Redacted)
	}
}
