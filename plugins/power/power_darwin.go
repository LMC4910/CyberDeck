//go:build darwin

package main

// commandFor returns the macOS command for a power action. Hibernate is not a
// standard user action on macOS, so it degrades to unsupported.
func commandFor(action string) (name string, args []string, ok bool) {
	switch action {
	case actShutdown:
		return "osascript", []string{"-e", `tell app "System Events" to shut down`}, true
	case actRestart:
		return "osascript", []string{"-e", `tell app "System Events" to restart`}, true
	case actLogoff:
		return "osascript", []string{"-e", `tell app "System Events" to log out`}, true
	case actSleep:
		return "pmset", []string{"sleepnow"}, true
	case actLock:
		return "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession",
			[]string{"-suspend"}, true
	case actHibernate:
		return "", nil, false // not supported on macOS
	default:
		return "", nil, false
	}
}
