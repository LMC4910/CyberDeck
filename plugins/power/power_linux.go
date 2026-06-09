//go:build linux

package main

// commandFor returns the Linux command for a power action (systemd / loginctl).
// Logoff has no portable single command across desktops, so it degrades to
// unsupported in V1.
func commandFor(action string) (name string, args []string, ok bool) {
	switch action {
	case actShutdown:
		return "systemctl", []string{"poweroff"}, true
	case actRestart:
		return "systemctl", []string{"reboot"}, true
	case actSleep:
		return "systemctl", []string{"suspend"}, true
	case actHibernate:
		return "systemctl", []string{"hibernate"}, true
	case actLock:
		return "loginctl", []string{"lock-session"}, true
	case actLogoff:
		return "", nil, false // no portable command in V1
	default:
		return "", nil, false
	}
}
