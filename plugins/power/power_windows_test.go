//go:build windows

package main

import "testing"

func TestWindowsCommandTable(t *testing.T) {
	cases := map[string]struct {
		name string
		args []string
	}{
		actShutdown:  {"shutdown", []string{"/s", "/t", "0"}},
		actRestart:   {"shutdown", []string{"/r", "/t", "0"}},
		actHibernate: {"shutdown", []string{"/h"}},
		actLogoff:    {"shutdown", []string{"/l"}},
		actLock:      {"rundll32", []string{"user32.dll,LockWorkStation"}},
		actSleep:     {"rundll32", []string{"powrprof.dll,SetSuspendState", "0,1,0"}},
	}
	for action, want := range cases {
		name, args, ok := commandFor(action)
		if !ok {
			t.Errorf("%s: not supported on windows", action)
			continue
		}
		if name != want.name {
			t.Errorf("%s: name = %q, want %q", action, name, want.name)
		}
		if len(args) != len(want.args) {
			t.Errorf("%s: args = %v, want %v", action, args, want.args)
			continue
		}
		for i := range args {
			if args[i] != want.args[i] {
				t.Errorf("%s: args[%d] = %q, want %q", action, i, args[i], want.args[i])
			}
		}
	}
	if _, _, ok := commandFor("system.bogus"); ok {
		t.Error("bogus action should not be supported")
	}
}
