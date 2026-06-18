package main

import "testing"

// fakeMedia records transport calls and returns scripted now-playing.
type fakeMedia struct {
	playPause  int
	next       int
	prev       int
	screenshot int
	record     int
	cast       int
	gamebar    int
	np         map[string]any
	ok         bool
}

func (f *fakeMedia) PlayPause() error                   { f.playPause++; return nil }
func (f *fakeMedia) Next() error                        { f.next++; return nil }
func (f *fakeMedia) Previous() error                    { f.prev++; return nil }
func (f *fakeMedia) Screenshot() error                  { f.screenshot++; return nil }
func (f *fakeMedia) Record() error                      { f.record++; return nil }
func (f *fakeMedia) Cast() error                        { f.cast++; return nil }
func (f *fakeMedia) Gamebar() error                     { f.gamebar++; return nil }
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

func TestExecuteDispatchesCapture(t *testing.T) {
	f := &fakeMedia{}
	for _, id := range []string{actScreenshot, actRecord, actCast, actGamebar} {
		if err := execute(f, id); err != nil {
			t.Fatalf("execute(%q): %v", id, err)
		}
	}
	if f.screenshot != 1 || f.record != 1 || f.cast != 1 || f.gamebar != 1 {
		t.Errorf("dispatch = screenshot %d / record %d / cast %d / gamebar %d, want 1/1/1/1",
			f.screenshot, f.record, f.cast, f.gamebar)
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
