package pal

// GPU is the graphics-processor telemetry capability (PROJ-172). Like Telemetry,
// every read follows the (value, ok) convention: ok=false means that reading is
// currently unavailable on this host/provider (the bound state reads "--"), never
// a fabricated zero. The first-party telemetry plugin selects the highest-available
// GPU source through a pal.Chain (NVIDIA → vendor → unavailable); machines without
// a supported GPU degrade cleanly to an unavailable chain.
type GPU interface {
	Load() (float64, bool)     // GPU utilisation %
	Temp() (float64, bool)     // GPU temperature, degrees Celsius
	VRAMUsed() (float64, bool)  // VRAM used, bytes
	VRAMTotal() (float64, bool) // VRAM total, bytes
}
