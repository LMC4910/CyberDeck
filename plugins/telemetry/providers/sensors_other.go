//go:build !windows

package providers

// PowerPlan / CPUTemp have no portable non-Windows source here yet, so they report
// unavailable (the bound widgets show their authored fallback / "--").
func (g *Gopsutil) PowerPlan() (string, bool) { return "", false }
func (g *Gopsutil) CPUTemp() (float64, bool)  { return 0, false }
