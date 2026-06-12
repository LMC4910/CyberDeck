//go:build !windows

package soak

import (
	"syscall"
	"time"
)

// processCPUTime returns the cumulative CPU time (user + system) consumed by the
// current process, via getrusage(RUSAGE_SELF). The soak differences successive
// readings against wall time to derive a CPU percentage.
func processCPUTime() time.Duration {
	var ru syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &ru); err != nil {
		return 0
	}
	return tvDuration(ru.Utime) + tvDuration(ru.Stime)
}

func tvDuration(tv syscall.Timeval) time.Duration {
	return time.Duration(tv.Sec)*time.Second + time.Duration(tv.Usec)*time.Microsecond
}
