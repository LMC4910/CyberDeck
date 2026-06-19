package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// haClient is a tiny Home Assistant REST client. It is optional: when the
// CYBERDECK_HA_URL / CYBERDECK_HA_TOKEN env vars are unset the plugin runs in
// pure local-state mode (no client). All methods return errors (never fatal) so
// an unreachable HA never crashes the plugin — callers keep the last local-state.
type haClient struct {
	base      string
	token     string
	hc        *http.Client
	entityMap map[string]string // cyberdeck control id → HA entity_id (e.g. "light.ceiling")
}

// newHAClientFromEnv builds a client from the environment, or returns nil when
// the URL or token is empty (signalling pure local-state mode).
//
//	CYBERDECK_HA_URL       base URL, e.g. http://homeassistant.local:8123
//	CYBERDECK_HA_TOKEN     long-lived access token (bearer)
//	CYBERDECK_HA_ENTITYMAP JSON object: {"home.lights.ceiling":"light.ceiling", ...}
func newHAClientFromEnv() *haClient {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("CYBERDECK_HA_URL")), "/")
	token := strings.TrimSpace(os.Getenv("CYBERDECK_HA_TOKEN"))
	if base == "" || token == "" {
		return nil
	}
	em := map[string]string{}
	if raw := strings.TrimSpace(os.Getenv("CYBERDECK_HA_ENTITYMAP")); raw != "" {
		_ = json.Unmarshal([]byte(raw), &em)
	}
	return &haClient{
		base:      base,
		token:     token,
		hc:        &http.Client{Timeout: 5 * time.Second},
		entityMap: em,
	}
}

// entityFor maps a cyberdeck control id to its HA entity_id.
func (c *haClient) entityFor(controlID string) (string, bool) {
	e, ok := c.entityMap[controlID]
	return e, ok
}

// domainEntityFor maps a control id to its (domain, entity_id) where the domain is
// the prefix of the entity_id (e.g. "light.ceiling" → ("light", "light.ceiling")).
func (c *haClient) domainEntityFor(controlID string) (domain, entity string, ok bool) {
	entity, ok = c.entityFor(controlID)
	if !ok {
		return "", "", false
	}
	domain = domainOf(entity)
	if domain == "" {
		return "", "", false
	}
	return domain, entity, true
}

// domainOf returns the HA domain prefix of an entity_id ("light.ceiling" → "light").
func domainOf(entity string) string {
	if i := strings.IndexByte(entity, '.'); i > 0 {
		return entity[:i]
	}
	return ""
}

// callService POSTs to /api/services/<domain>/<service> with a bearer token and a
// {"entity_id":"..."} body.
func (c *haClient) callService(domain, service, entityID string) error {
	body, err := json.Marshal(map[string]string{"entity_id": entityID})
	if err != nil {
		return err
	}
	url := fmt.Sprintf("%s/api/services/%s/%s", c.base, domain, service)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("ha: %s %s → %s", domain, service, resp.Status)
	}
	return nil
}

// haState is one entry from GET /api/states.
type haState struct {
	EntityID string `json:"entity_id"`
	State    string `json:"state"`
}

// states fetches GET /api/states and returns a map of entity_id → state string.
func (c *haClient) states() (map[string]any, error) {
	url := c.base + "/api/states"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("ha: states → %s", resp.Status)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var list []haState
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, err
	}
	out := make(map[string]any, len(list))
	for _, s := range list {
		out[s.EntityID] = s.State
	}
	return out, nil
}
