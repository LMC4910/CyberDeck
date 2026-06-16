package providers

import (
	"sort"

	"github.com/shirou/gopsutil/v4/process"
)

// maxTopProcesses is how many rows the "Top Processes" card shows.
const maxTopProcesses = 5

// TopProcesses returns up to the highest-CPU processes as {name, cpu} maps (cpu is
// a percentage). ok=false when the process table can't be read. CPU% is gopsutil's
// cumulative-since-start figure — sufficient to rank "top processes" without
// per-process sampling state. Values are typed; the client formats for display.
func (g *Gopsutil) TopProcesses() ([]map[string]any, bool) {
	procs, err := process.Processes()
	if err != nil || len(procs) == 0 {
		return nil, false
	}
	type row struct {
		name string
		cpu  float64
	}
	rows := make([]row, 0, len(procs))
	for _, p := range procs {
		cpu, err := p.CPUPercent()
		if err != nil {
			continue
		}
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}
		rows = append(rows, row{name: name, cpu: cpu})
	}
	if len(rows) == 0 {
		return nil, false
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].cpu > rows[j].cpu })
	if len(rows) > maxTopProcesses {
		rows = rows[:maxTopProcesses]
	}
	out := make([]map[string]any, len(rows))
	for i, r := range rows {
		out[i] = map[string]any{"name": r.name, "cpu": r.cpu}
	}
	return out, true
}
