//go:build windows

// Windows system controller: performance modes map to power-plan GUIDs via
// powercfg; Empty Recycle Bin uses shell32 SHEmptyRecycleBin; Clear Cache wipes the
// user temp directory best-effort.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// planGUID maps a performance mode to its Windows power-scheme GUID.
var planGUID = map[string]string{
	modeSilent:      "a1841308-3541-4fab-bc81-f71556f20b4a", // Power saver
	modeBalanced:    "381b4222-f694-41f0-9685-ff5bb260df2e", // Balanced
	modePerformance: "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c", // High performance
	modeTurbo:       "e9a42b02-d5df-448d-aa00-03f14749eb61", // Ultimate Performance
}

type winControl struct{}

func newSysControl() sysControl { return winControl{} }

func (winControl) SetPowerPlan(mode string) error {
	guid, ok := planGUID[mode]
	if !ok {
		return fmt.Errorf("system: unknown performance mode %q", mode)
	}
	if err := exec.Command("powercfg", "/setactive", guid).Run(); err != nil {
		// Ultimate Performance isn't present on every SKU — fall back to High perf.
		if mode == modeTurbo {
			return exec.Command("powercfg", "/setactive", planGUID[modePerformance]).Run()
		}
		return err
	}
	return nil
}

func (winControl) ActivePlan() (string, bool) {
	out, err := exec.Command("powercfg", "/getactivescheme").Output()
	if err != nil {
		return "", false
	}
	s := strings.ToLower(string(out))
	for mode, guid := range planGUID {
		if strings.Contains(s, strings.ToLower(guid)) {
			return mode, true
		}
	}
	return "", false
}

func (winControl) EmptyRecycleBin() error {
	proc := syscall.NewLazyDLL("shell32.dll").NewProc("SHEmptyRecycleBinW")
	const flags = 0x1 | 0x2 | 0x4 // NOCONFIRMATION | NOPROGRESSUI | NOSOUND
	r, _, _ := proc.Call(0, 0, uintptr(flags))
	// S_OK (0); 0x8000FFFF (E_UNEXPECTED) is returned when the bin is already empty.
	if r != 0 && r != 0x8000FFFF {
		return fmt.Errorf("SHEmptyRecycleBin hr=0x%x", r)
	}
	return nil
}

func (winControl) ClearCache() error {
	tmp := os.TempDir()
	entries, err := os.ReadDir(tmp)
	if err != nil {
		return err
	}
	for _, e := range entries {
		_ = os.RemoveAll(filepath.Join(tmp, e.Name())) // best-effort; locked files skipped
	}
	return nil
}
