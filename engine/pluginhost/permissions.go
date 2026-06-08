package pluginhost

// Plugin→capability permission gate (2F §7) — the SECOND of the two gates (the
// first is the device→action gate, PROJ-125). It is enforced at the host IPC
// boundary: a plugin may only publish states it declared, and may only access
// resources up to its manifest's declared level. V1 enforces declared-vs-actual
// at the boundary; OS-level sandboxing is Phase 6 (ADR-0028).

// AuditDenier records a plugin permission denial (wired to the audit log, PROJ-127,
// at PROJ-105). kind is e.g. "state" | "network" | "filesystem".
type AuditDenier interface {
	PluginDenied(plugin, kind, detail string)
}

// networkRank / filesystemRank order the declared access levels.
func networkRank(level string) int {
	switch level {
	case "outbound":
		return 2
	case "localhost":
		return 1
	default: // "none" / unset
		return 0
	}
}

func filesystemRank(level string) int {
	if level == "own-dir" {
		return 1
	}
	return 0 // "none" / unset
}

// AllowNetwork reports whether a requested network level is within the granted
// level (none < localhost < outbound).
func AllowNetwork(granted, requested string) bool {
	return networkRank(requested) <= networkRank(granted)
}

// AllowFilesystem reports whether a requested filesystem level is within the
// granted level (none < own-dir).
func AllowFilesystem(granted, requested string) bool {
	return filesystemRank(requested) <= filesystemRank(granted)
}

// allowsState reports whether the plugin declared the given state id.
func (p *Plugin) allowsState(id string) bool {
	p.stateMu.Lock()
	defer p.stateMu.Unlock()
	for _, s := range p.declaredStates {
		if s == id {
			return true
		}
	}
	return false
}

// CheckNetwork enforces the plugin's declared network level for a requested
// access, auditing a denial.
func (p *Plugin) CheckNetwork(requested string) bool {
	if AllowNetwork(p.perms.Network, requested) {
		return true
	}
	p.host.auditDenied(p.name, "network", requested)
	return false
}

// CheckFilesystem enforces the plugin's declared filesystem level for a requested
// access, auditing a denial.
func (p *Plugin) CheckFilesystem(requested string) bool {
	if AllowFilesystem(p.perms.Filesystem, requested) {
		return true
	}
	p.host.auditDenied(p.name, "filesystem", requested)
	return false
}

func (h *Host) auditDenied(plugin, kind, detail string) {
	h.logger.Printf("pluginhost: %s: denied %s access %q (not granted by manifest)", plugin, kind, detail)
	if h.denier != nil {
		h.denier.PluginDenied(plugin, kind, detail)
	}
}
