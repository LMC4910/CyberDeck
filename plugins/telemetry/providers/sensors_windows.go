//go:build windows

package providers

import (
	"os/exec"
	"strconv"
	"strings"
)

// PowerPlan returns the active Windows power scheme's friendly name (e.g.
// "Balanced", "High performance") via powercfg. ok=false if it can't be read.
func (g *Gopsutil) PowerPlan() (string, bool) {
	out, err := exec.Command("powercfg", "/getactivescheme").Output()
	if err != nil {
		return "", false
	}
	// Output form: "Power Scheme GUID: <guid>  (Balanced)".
	s := string(out)
	i := strings.LastIndex(s, "(")
	j := strings.LastIndex(s, ")")
	if i >= 0 && j > i {
		if name := strings.TrimSpace(s[i+1 : j]); name != "" {
			return name, true
		}
	}
	return "", false
}

// CPUTemp reads the CPU temperature (°C) from LibreHardwareMonitor's WMI namespace
// via PowerShell, when LHM is running. ok=false otherwise (the gauge shows "--") —
// gopsutil has no portable CPU-temperature source on Windows.
func (g *Gopsutil) CPUTemp() (float64, bool) {
	const script = `$s=Get-CimInstance -Namespace root/LibreHardwareMonitor -Class Sensor -ErrorAction SilentlyContinue | Where-Object {$_.SensorType -eq 'Temperature' -and $_.Name -like '*CPU*'}; if($s){ ($s | Measure-Object -Property Value -Maximum).Maximum }`
	out, err := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script).Output()
	if err != nil {
		return 0, false
	}
	txt := strings.TrimSpace(string(out))
	if txt == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(txt, 64)
	if err != nil || v <= 0 {
		return 0, false
	}
	return v, true
}
