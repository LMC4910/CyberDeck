package main

import "testing"

// fakeMedia records transport calls and returns scripted now-playing.
type fakeMedia struct {
	playPause int
	next      int
	prev      int
	np        map[string]any
	ok        bool
}

func (f *fakeMedia) PlayPause() error { f.playPause++; return nil }
func (f *fakeMedia) Next() error      { f.next++; return nil }
func (f *fakeMedia) Previous() error  { f.prev++; return nil }
func (f *fakeMedia) NowPlaying() (map[string]any, bool) { return f.np, f.ok }
func (f *fakeMedia) Close() error                       { return nil }

func TestExecuteDispatchesTransport(t *testing.T) {
	f := &fakeMedia{}
	for _, id := range []string{actPlayPause, actNext, actPrevious} {
		if err := execute(f, id); err != nil {
			t.Fatalf("execute(%q): %v", id, err)
		}
	}
	if f.playPause != 1 || f.next != 1 || f.prev != 1 {
		t.Errorf("dispatch = play %d / next %d / prev %d, want 1/1/1",
			f.playPause, f.next, f.prev)
	}
}

func TestExecuteUnknownErrors(t *testing.T) {
	if err := execute(&fakeMedia{}, "media.bogus"); err == nil {
		t.Error("unknown action should error")
	}
}

func TestNoopMediaHasNoNowPlaying(t *testing.T) {
	if _, ok := (noopMedia{}).NowPlaying(); ok {
		t.Error("noopMedia should report no now-playing")
	}
}
