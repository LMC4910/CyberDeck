package pluginhost

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/shishir/cyberdeck/engine/core/registry"
)

// Plugin manifest (2F §3). A plugin declares its API version, required permissions,
// and its registry contributions (states/actions/widgets/flow-nodes). The host
// validates the manifest, gates on apiVersion, and merges contributions into the
// global registries (PROJ-161). First-party manifests use this exact path.

// SupportedAPIMajor is the plugin API major version this engine supports. A
// manifest declaring a different major is refused (Master §6.4).
const SupportedAPIMajor = 1

// ErrIncompatibleAPIVersion is returned when a manifest's apiVersion major differs
// from the engine's supported major.
var ErrIncompatibleAPIVersion = errors.New("pluginhost: incompatible plugin apiVersion")

// ManifestPermissions are the access levels a plugin declares (recorded for
// enforcement at the IPC boundary, PROJ-133).
type ManifestPermissions struct {
	Categories []string `json:"categories,omitempty"` // action categories it contributes
	Network    string   `json:"network,omitempty"`    // none | localhost | outbound
	Filesystem string   `json:"filesystem,omitempty"` // none | own-dir
}

// Contributes reuses the registry descriptor types so a manifest parses directly
// into them (single source of truth).
type Contributes struct {
	Actions   []registry.ActionDescriptor   `json:"actions,omitempty"`
	Widgets   []registry.WidgetDescriptor   `json:"widgets,omitempty"`
	FlowNodes []registry.FlowNodeDescriptor `json:"flowNodes,omitempty"`
}

// Manifest is a parsed plugin.manifest.json.
type Manifest struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	APIVersion  string              `json:"apiVersion"`
	Permissions ManifestPermissions `json:"permissions"`
	Contributes Contributes         `json:"contributes"`
}

// ParseManifest decodes and structurally validates a manifest.
func ParseManifest(data []byte) (*Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("pluginhost: parse manifest: %w", err)
	}
	if err := m.validate(); err != nil {
		return nil, err
	}
	return &m, nil
}

// LoadManifest reads and parses a manifest file.
func LoadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("pluginhost: read manifest %q: %w", path, err)
	}
	return ParseManifest(data)
}

func (m *Manifest) validate() error {
	if m.ID == "" {
		return errors.New("manifest: id required")
	}
	if m.Name == "" {
		return fmt.Errorf("manifest %q: name required", m.ID)
	}
	if m.APIVersion == "" {
		return fmt.Errorf("manifest %q: apiVersion required", m.ID)
	}
	switch m.Permissions.Network {
	case "", "none", "localhost", "outbound":
	default:
		return fmt.Errorf("manifest %q: invalid network permission %q", m.ID, m.Permissions.Network)
	}
	switch m.Permissions.Filesystem {
	case "", "none", "own-dir":
	default:
		return fmt.Errorf("manifest %q: invalid filesystem permission %q", m.ID, m.Permissions.Filesystem)
	}
	return nil
}

// CheckAPIVersion refuses a manifest whose apiVersion major differs from the
// engine's supported major.
func (m *Manifest) CheckAPIVersion() error {
	major, err := apiMajor(m.APIVersion)
	if err != nil {
		return fmt.Errorf("%w: unparseable %q", ErrIncompatibleAPIVersion, m.APIVersion)
	}
	if major != SupportedAPIMajor {
		return fmt.Errorf("%w: manifest %q is major %d, engine supports major %d",
			ErrIncompatibleAPIVersion, m.APIVersion, major, SupportedAPIMajor)
	}
	return nil
}

func apiMajor(v string) (int, error) {
	s := v
	if i := strings.IndexByte(v, '.'); i >= 0 {
		s = v[:i]
	}
	return strconv.Atoi(s)
}

// MergeManifest gates on apiVersion, then merges the manifest's contributions into
// the registry (PROJ-161 supplies collision rejection + persistence). It returns
// the declared permissions for the caller to record (PROJ-133).
func MergeManifest(ctx context.Context, reg *registry.Registry, m *Manifest) (ManifestPermissions, error) {
	if err := m.CheckAPIVersion(); err != nil {
		return ManifestPermissions{}, err
	}
	err := reg.Merge(ctx, registry.Contributions{
		Source:    m.ID,
		Actions:   m.Contributes.Actions,
		Widgets:   m.Contributes.Widgets,
		FlowNodes: m.Contributes.FlowNodes,
	})
	if err != nil {
		return ManifestPermissions{}, err
	}
	return m.Permissions, nil
}
