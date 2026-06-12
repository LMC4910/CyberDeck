package layout

import (
	"context"
	"sync"
)

// Undo/redo (PROJ-215, 2C §4 / ADR-0012). Every applied op already yields its
// inverse (computed from the pre-state, see Apply). This file turns those inverses
// into per-document undo/redo stacks: undo applies the recorded inverse, redo
// re-applies the original op — both go back through the SAME apply path so they
// version, persist, and broadcast exactly like a normal edit (edit-on-desktop →
// live-on-device, no special-casing on the client).
//
// The stacks hold (op, inverse) pairs so the manager can both reverse a step and
// reverse-the-reversal:
//
//   - apply(op)  → record (op, inverse) on undo; clear redo (new edit forks history).
//   - undo()     → pop the top pair, apply its inverse, push the (inverse-of-inverse,
//                  original) onto redo so a later redo restores the edit.
//   - redo()     → pop the top redo pair, apply its op, push the resulting pair back
//                  onto undo.
//
// Because applying the inverse itself returns a fresh inverse (Apply is total over
// reversible ops — ADR-0012), undo/redo compose to arbitrary depth without storing
// snapshots.

// applier applies an op to a document and returns the inverse op. Both *OpLog and
// *Broadcaster satisfy a thin adapter to this (see Bind* helpers below), so undo
// works with or without live broadcast.
type applier interface {
	apply(ctx context.Context, op Op) (inverse Op, err error)
}

// step is one reversible edit kept on a stack: the op that was applied and the
// inverse that reverses it.
type step struct {
	op      Op
	inverse Op
}

// UndoManager keeps undo/redo stacks for a single document and drives them through
// an applier. It is safe for concurrent use; the single-writer edit lock (OpLog)
// still governs who may edit at all (2C §4.3).
type UndoManager struct {
	applier applier

	mu   sync.Mutex
	undo []step
	redo []step
}

// NewUndoManager binds an undo manager to an applier for one document.
func NewUndoManager(a applier) *UndoManager {
	return &UndoManager{applier: a}
}

// Apply applies a fresh edit, recording it so it can be undone. A new edit clears
// the redo stack (the standard linear-history rule: editing after an undo forks the
// timeline, discarding the redo branch). Returns the inverse + the new version is
// implicit in the applier; callers that need the version should use the applier's
// own Apply. Apply returns the inverse for parity with the rest of the package.
func (m *UndoManager) Apply(ctx context.Context, op Op) (Op, error) {
	inv, err := m.applier.apply(ctx, op)
	if err != nil {
		return Op{}, err
	}
	m.mu.Lock()
	m.undo = append(m.undo, step{op: op, inverse: inv})
	m.redo = m.redo[:0]
	m.mu.Unlock()
	return inv, nil
}

// CanUndo reports whether there is an edit to undo.
func (m *UndoManager) CanUndo() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.undo) > 0
}

// CanRedo reports whether there is an undone edit to redo.
func (m *UndoManager) CanRedo() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.redo) > 0
}

// Undo reverses the most recent edit by applying its inverse through the apply path
// (so it versions/persists/broadcasts like any edit). The reversed step moves to the
// redo stack. Returns ErrNothingToUndo when the stack is empty.
func (m *UndoManager) Undo(ctx context.Context) error {
	m.mu.Lock()
	if len(m.undo) == 0 {
		m.mu.Unlock()
		return ErrNothingToUndo
	}
	s := m.undo[len(m.undo)-1]
	m.mu.Unlock()

	// Apply the inverse. Applying it yields the inverse-of-the-inverse, which is the
	// op that re-does the original edit — keep it paired with the original op so redo
	// reproduces the exact edit.
	redoInverse, err := m.applier.apply(ctx, s.inverse)
	if err != nil {
		return err
	}

	m.mu.Lock()
	m.undo = m.undo[:len(m.undo)-1]
	m.redo = append(m.redo, step{op: s.op, inverse: redoInverse})
	m.mu.Unlock()
	return nil
}

// Redo re-applies the most recently undone edit through the apply path. The
// re-applied step moves back to the undo stack. Returns ErrNothingToRedo when the
// stack is empty.
func (m *UndoManager) Redo(ctx context.Context) error {
	m.mu.Lock()
	if len(m.redo) == 0 {
		m.mu.Unlock()
		return ErrNothingToRedo
	}
	s := m.redo[len(m.redo)-1]
	m.mu.Unlock()

	inv, err := m.applier.apply(ctx, s.op)
	if err != nil {
		return err
	}

	m.mu.Lock()
	m.redo = m.redo[:len(m.redo)-1]
	m.undo = append(m.undo, step{op: s.op, inverse: inv})
	m.mu.Unlock()
	return nil
}

// logApplier adapts an *OpLog to the applier interface for a fixed document.
type logApplier struct {
	log   *OpLog
	docID string
}

func (a logApplier) apply(ctx context.Context, op Op) (Op, error) {
	inv, _, err := a.log.Apply(ctx, a.docID, op)
	return inv, err
}

// BindOpLog returns an UndoManager that drives undo/redo through an op-log for a
// document (persist-only; no broadcast).
func BindOpLog(log *OpLog, docID string) *UndoManager {
	return NewUndoManager(logApplier{log: log, docID: docID})
}

// broadcastApplier adapts a *Broadcaster to the applier interface for a fixed
// document + profile, so undo/redo broadcast live like any edit.
type broadcastApplier struct {
	b         *Broadcaster
	docID     string
	profileID string
}

func (a broadcastApplier) apply(ctx context.Context, op Op) (Op, error) {
	inv, _, err := a.b.ApplyAndBroadcast(ctx, a.docID, a.profileID, op)
	return inv, err
}

// BindBroadcaster returns an UndoManager that drives undo/redo through a broadcaster
// (the live edit-on-desktop path): each undo/redo re-broadcasts to the device.
func BindBroadcaster(b *Broadcaster, docID, profileID string) *UndoManager {
	return NewUndoManager(broadcastApplier{b: b, docID: docID, profileID: profileID})
}
