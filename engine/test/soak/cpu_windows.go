//go:build windows

package soak

import (
	"time"

	"golang.org/x/sys/windows"
)

// processCPUTime returns the cumulative CPU time (kernel + user) consumed by the
// current process. The soak differences successive readings against wall time to
// derive a CPU percentage. On Windows this is GetProcessTimes; the Filetime
// pair is in 100-nanosecond ticks.
func processCPUTime() time.Duration {
	h := windows.CurrentProcess()
	var creation, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(h, &creation, &exit, &kernel, &user); err != nil {
		return 0
	}
	ticks := filetimeTicks(kernel) + filetimeTicks(user)
	return time.Duration(ticks) * 100 * time.Nanosecond
}

func filetimeTicks(ft windows.Filetime) int64 {
	return int64(ft.HighDateTime)<<32 | int64(ft.LowDateTime)
}
