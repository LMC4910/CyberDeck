module github.com/shishir/cyberdeck/plugins/system

go 1.25.0

require github.com/shishir/cyberdeck/engine v0.0.0

// The engine module is part of this repo (unpublished); resolve it locally (the root
// go.work does the same in-workspace).
replace github.com/shishir/cyberdeck/engine => ../../engine
