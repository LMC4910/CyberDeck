package secrets

import "reflect"

var secretType = reflect.TypeOf(Secret{})

// ContainsSecret reports whether v's type holds a Secret anywhere in its
// structure (directly, or nested through pointers, slices, arrays, maps, or
// structs). It inspects the TYPE, so a zero value is sufficient.
//
// It is the basis of the PROJ-115 leak guard: persisted entity types and log
// payloads must never contain a Secret, because secrets live only in the OS
// secret store (2E §7, TB-PER-3) — never in SQLite, config, or logs.
func ContainsSecret(v any) bool {
	if v == nil {
		return false
	}
	return typeContainsSecret(reflect.TypeOf(v), map[reflect.Type]bool{})
}

func typeContainsSecret(t reflect.Type, seen map[reflect.Type]bool) bool {
	if t == nil || seen[t] {
		return false
	}
	if t == secretType {
		return true
	}
	seen[t] = true

	switch t.Kind() {
	case reflect.Pointer, reflect.Slice, reflect.Array:
		return typeContainsSecret(t.Elem(), seen)
	case reflect.Map:
		return typeContainsSecret(t.Key(), seen) || typeContainsSecret(t.Elem(), seen)
	case reflect.Struct:
		for i := 0; i < t.NumField(); i++ {
			if typeContainsSecret(t.Field(i).Type, seen) {
				return true
			}
		}
	}
	return false
}
