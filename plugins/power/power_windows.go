//go:build windows

package main

// commandFor returns the Windows command for a power action.
func commandFor(action string) (name string, args []string, ok bool) {
	switch action {
	case actShutdown:
		return "shutdown", []string{"/s", "/t", "0"}, true
	case actRestart:
		return "shutdown", []string{"/r", "/t", "0"}, true
	case actHibernate:
		return "shutdown", []string{"/h"}, true
	case actLogoff:
		return "shutdown", []string{"/l"}, true
	case actLock:
		return "rundll32", []string{"user32.dll,LockWorkStation"}, true
	case actSleep:
		// Suspend (S3). Note: if hibernation is enabled the OS may hibernate.
		return "rundll32", []string{"powrprof.dll,SetSuspendState", "0,1,0"}, true
	default:
		return "", nil, false
	}
}
