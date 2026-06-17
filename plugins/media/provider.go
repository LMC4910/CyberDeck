// Command media is the first-party CyberDeck media plugin: it controls media
// transport (play/pause, next, previous) and publishes the system "now playing"
// state. Transport uses the OS media keys (Windows) so it drives whatever app is
// playing; now-playing is read from the OS session (Windows SMTC) where available.
// The controller is mockable so tests never touch real media.
package main

import "fmt"

// Media transport action IDs.
const (
	actPlayPause = "media.transport.playPause"
	actNext      = "media.transport.next"
	actPrevious  = "media.transport.previous"
)

// mediaControl drives transport and reads now-playing. Injectable for tests and
// per-OS implementations (newMediaControl()).
type mediaControl interface {
	PlayPause() error
	Next() error
	Previous() error
	// NowPlaying returns the current track as a map
	// {track,artist,playing,progress,elapsed,duration}; ok=false when nothing is
	// playing or the OS source is unavailable.
	NowPlaying() (map[string]any, bool)
	// Close releases any OS resources (e.g. a now-playing reader subprocess).
	Close() error
}

// noopMedia is the dry-run / unsupported controller: no transport, no now-playing.
type noopMedia struct{}

func (noopMedia) PlayPause() error                   { return nil }
func (noopMedia) Next() error                        { return nil }
func (noopMedia) Previous() error                    { return nil }
func (noopMedia) NowPlaying() (map[string]any, bool) { return nil, false }
func (noopMedia) Close() error                       { return nil }

// execute dispatches a transport action to the controller.
func execute(c mediaControl, actionID string) error {
	switch actionID {
	case actPlayPause:
		return c.PlayPause()
	case actNext:
		return c.Next()
	case actPrevious:
		return c.Previous()
	default:
		return fmt.Errorf("media: unknown action %q", actionID)
	}
}
