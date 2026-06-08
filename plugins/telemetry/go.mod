module github.com/shishir/cyberdeck/plugins/telemetry

go 1.25.0

require (
	github.com/shirou/gopsutil/v4 v4.25.1
	github.com/shishir/cyberdeck/engine v0.0.0
)

require (
	github.com/ebitengine/purego v0.8.2 // indirect
	github.com/go-ole/go-ole v1.2.6 // indirect
	github.com/lufia/plan9stats v0.0.0-20211012122336-39d0f177ccd0 // indirect
	github.com/power-devops/perfstat v0.0.0-20210106213030-5aafc221ea8c // indirect
	github.com/tklauser/go-sysconf v0.3.12 // indirect
	github.com/tklauser/numcpus v0.6.1 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	golang.org/x/sys v0.45.0 // indirect
)

// The engine module is part of this repo (unpublished); resolve it from the local
// tree. The root go.work does the same for in-workspace builds; this keeps
// `cd plugins/telemetry && go build .` working standalone (the ticket's gate).
replace github.com/shishir/cyberdeck/engine => ../../engine
