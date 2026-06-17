//go:build windows

package main

import "testing"

// TestWinVolumeGetSmoke proves the WASAPI controller constructs and reads without
// panicking. It is read-only (no SetVolume/SetMute side effects) and tolerates
// ok=false on headless CI with no audio endpoint.
func TestWinVolumeGetSmoke(t *testing.T) {
	c := newOSVolume()
	vol, _, ok := c.Get()
	if ok && (vol < 0 || vol > 100) {
		t.Errorf("Get() returned out-of-range volume %v", vol)
	}
}
