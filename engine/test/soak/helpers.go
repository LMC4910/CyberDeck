package soak

import (
	"io"
	"log"
	"path/filepath"
)

// discardLogger is a no-op logger for the pump (the soak doesn't care about its
// chatter; budget signals come from the samples).
func discardLogger() *log.Logger { return log.New(io.Discard, "", 0) }

// dirOf returns the directory part of a path (for MkdirAll before WriteFile).
func dirOf(path string) string {
	d := filepath.Dir(path)
	if d == "" {
		return "."
	}
	return d
}
