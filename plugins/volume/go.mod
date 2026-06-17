module github.com/shishir/cyberdeck/plugins/volume

go 1.25.0

require (
	github.com/go-ole/go-ole v1.2.6
	github.com/shishir/cyberdeck/engine v0.0.0
)

require golang.org/x/sys v0.45.0 // indirect

// The engine module is part of this repo (unpublished); resolve it locally (the root
// go.work does the same in-workspace).
replace github.com/shishir/cyberdeck/engine => ../../engine
