module github.com/shishir/cyberdeck/plugins/notifications

go 1.25.0

require github.com/shishir/cyberdeck/engine v0.0.0

// The engine module is part of this repo (unpublished); resolve it locally. The
// root go.work does the same in-workspace; this keeps the ticket gate
// `cd plugins/notifications && go build .` working standalone.
replace github.com/shishir/cyberdeck/engine => ../../engine
