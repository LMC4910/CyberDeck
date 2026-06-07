// Package pluginhost supervises out-of-process plugins and brokers their IPC.
//
// All capabilities are out-of-process plugins on one contract (ADR-0006), and a
// crashing plugin must never take down the engine (NFR-07). The implementation
// arrives with PROJ-130/131/132/133; this file is the PROJ-101 scaffold.
package pluginhost
