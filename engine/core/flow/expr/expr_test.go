package expr

import (
	"math"
	"testing"
)

func ctx() MapContext {
	return MapContext{
		"system.cpu.percent": 90.0,
		"var.threshold":      85.0,
		"var.name":           "deck",
		"flag":               true,
	}
}

func TestOperatorMatrix(t *testing.T) {
	cases := map[string]any{
		"1 + 2 * 3":        7.0,   // precedence
		"(1 + 2) * 3":      9.0,
		"10 / 4":           2.5,
		"10 % 3":           1.0,
		"-5 + 2":           -3.0,
		"2 > 1":            true,
		"2 < 1":            false,
		"3 >= 3":           true,
		"1 == 1":           true,
		"1 != 2":           true,
		"true && false":    false,
		"true || false":    true,
		"!false":           true,
		"'a' + 'b'":        "ab",
		"'x' == 'x'":       true,
		"2 + 3 > 4 && 1<2": true,
	}
	for src, want := range cases {
		got, err := Eval(src, nil)
		if err != nil {
			t.Errorf("%q: error %v", src, err)
			continue
		}
		if got != want {
			t.Errorf("%q = %v (%T), want %v (%T)", src, got, got, want, want)
		}
	}
}

func TestStateTokens(t *testing.T) {
	c := ctx()
	got, err := Eval("system.cpu.percent > var.threshold", c)
	if err != nil || got != true {
		t.Errorf("cpu>threshold = %v, %v; want true", got, err)
	}
	got, _ = Eval("var.name == 'deck' && flag", c)
	if got != true {
		t.Errorf("name+flag = %v, want true", got)
	}
}

func TestUnavailableTokenSafeDefault(t *testing.T) {
	c := ctx()
	// Missing token → nil → comparison is false, no crash.
	for _, src := range []string{
		"missing.token > 5",
		"missing.token == 1",
		"missing.token + 1 > 0", // nil propagates through '+' → nil > 0 → false
		"system.gpu.temp >= 80",
	} {
		got, err := Eval(src, c)
		if err != nil {
			t.Errorf("%q errored: %v", src, err)
		}
		if got != false {
			t.Errorf("%q = %v, want false (safe default)", src, got)
		}
	}
}

func TestTypeMismatchIsErrorNotPanic(t *testing.T) {
	for _, src := range []string{
		"'a' * 2",
		"true - 1",
		"'a' < 2",
		"-'x'",
	} {
		if _, err := Eval(src, nil); err == nil {
			t.Errorf("%q should be a type-mismatch error", src)
		}
	}
}

func TestDivisionByZero(t *testing.T) {
	if _, err := Eval("1 / 0", nil); err == nil {
		t.Error("1/0 should error")
	}
	if _, err := Eval("5 % 0", nil); err == nil {
		t.Error("5%0 should error")
	}
}

func TestMalformedAndInjectionRejected(t *testing.T) {
	for _, src := range []string{
		"",            // empty
		"1 +",         // trailing operator
		"(1 + 2",      // unbalanced
		"1 2",         // two primaries
		"exec('rm')",  // no call syntax → parse error at '('
		"system.;",    // bad member
		"a = 1",       // no assignment
		"`backtick`",  // illegal char
		"1 ; 2",       // illegal char
	} {
		if _, err := Eval(src, nil); err == nil {
			t.Errorf("%q should be rejected at parse", src)
		}
	}
}

func TestModuloFloat(t *testing.T) {
	got, err := Eval("10.5 % 3", nil)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(got.(float64)-1.5) > 1e-9 {
		t.Errorf("10.5%%3 = %v, want 1.5", got)
	}
}
