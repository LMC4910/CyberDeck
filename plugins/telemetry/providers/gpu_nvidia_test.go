package providers

import "testing"

// TestParseNvidiaCSV covers a normal row, per-field [N/A] isolation, MiB→bytes
// scaling, and a wholly empty/garbage output degrading to ok=false.
func TestParseNvidiaCSV(t *testing.T) {
	const mib = 1024 * 1024

	t.Run("full row", func(t *testing.T) {
		snap, ok := parseNvidiaCSV("37, 64, 2048, 8192\n")
		if !ok {
			t.Fatal("ok=false on a valid row")
		}
		if !snap.loadOK || snap.load != 37 {
			t.Errorf("load = (%v,%v), want (37,true)", snap.load, snap.loadOK)
		}
		if !snap.tempOK || snap.temp != 64 {
			t.Errorf("temp = (%v,%v), want (64,true)", snap.temp, snap.tempOK)
		}
		if !snap.vramUsedOK || snap.vramUsed != 2048*mib {
			t.Errorf("vramUsed = %v, want %v bytes", snap.vramUsed, 2048*mib)
		}
		if !snap.vramTotalOK || snap.vramTotal != 8192*mib {
			t.Errorf("vramTotal = %v, want %v bytes", snap.vramTotal, 8192*mib)
		}
	})

	t.Run("partial N/A isolated", func(t *testing.T) {
		// Temp unsupported on this board; the other fields must still parse.
		snap, ok := parseNvidiaCSV("37, [N/A], 2048, 8192")
		if !ok {
			t.Fatal("ok=false despite three valid fields")
		}
		if snap.tempOK {
			t.Error("temp should be ok=false for [N/A]")
		}
		if !snap.loadOK || !snap.vramUsedOK || !snap.vramTotalOK {
			t.Error("other fields should remain available")
		}
	})

	t.Run("empty degrades", func(t *testing.T) {
		if _, ok := parseNvidiaCSV("\n  \n"); ok {
			t.Error("ok=true on empty output")
		}
		if _, ok := parseNvidiaCSV("only,two"); ok {
			t.Error("ok=true on a short row")
		}
	})
}

// TestNvidiaSampleUsesInjectedRunner proves the source parses what the runner
// returns and reports unavailable on a runner error (no real process spawned).
func TestNvidiaSampleUsesInjectedRunner(t *testing.T) {
	good := &nvidiaSource{run: func() ([]byte, error) { return []byte("50, 80, 1024, 4096\n"), nil }}
	if snap, ok := good.sample(); !ok || snap.load != 50 || !snap.tempOK {
		t.Errorf("sample = (%+v,%v), want parsed snapshot", snap, ok)
	}

	bad := &nvidiaSource{run: func() ([]byte, error) { return nil, errFake }}
	if _, ok := bad.sample(); ok {
		t.Error("sample ok=true despite runner error")
	}
}

type fakeErr struct{}

func (fakeErr) Error() string { return "fake" }

var errFake = fakeErr{}
