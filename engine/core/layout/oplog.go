package layout

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/core/persistence"
)

// OpKind enumerates the layout operations (2C §4.1). Each op is discrete and
// invertible — the substrate for live broadcast (PROJ-212), undo/redo (PROJ-215),
// and (Phase 8) collaboration.
type OpKind string

const (
	OpAddWidget      OpKind = "AddWidget"
	OpRemoveWidget   OpKind = "RemoveWidget"
	OpMoveWidget     OpKind = "MoveWidget"
	OpResizeWidget   OpKind = "ResizeWidget"
	OpSetStyle       OpKind = "SetStyle"
	OpSetBinding     OpKind = "SetBinding"
	OpSetInteraction OpKind = "SetInteraction"
	OpSetConfig      OpKind = "SetConfig"
	OpChangeGrid     OpKind = "ChangeGrid"
	OpAddPage        OpKind = "AddPage"
	OpRemovePage     OpKind = "RemovePage"
)

// Op is a single, pure-data layout operation. Only the fields relevant to Kind are
// populated. The same JSON shape is produced by the Designer's op builder and
// applied by the client renderer (PROJ-181), so all three sides agree.
type Op struct {
	Kind        OpKind         `json:"op"`
	PageID      string         `json:"pageId,omitempty"`
	WidgetID    string         `json:"widgetId,omitempty"`
	Widget      *Widget        `json:"widget,omitempty"`
	Page        *Page          `json:"page,omitempty"`
	To          *Placement     `json:"to,omitempty"`
	Style       map[string]any `json:"style,omitempty"`
	Binding     *string        `json:"stateBinding,omitempty"`
	Interaction map[string]any `json:"interaction,omitempty"`
	Config      map[string]any `json:"config,omitempty"`
	Grid        map[string]any `json:"grid,omitempty"`
}

// Sentinel errors so callers/tests can distinguish failures.
var (
	ErrPageNotFound   = errors.New("layout: page not found")
	ErrWidgetNotFound = errors.New("layout: widget not found")
	ErrBadOp          = errors.New("layout: malformed operation")
	ErrEditLocked     = errors.New("layout: document is locked for editing")
	ErrNothingToUndo  = errors.New("layout: nothing to undo")
	ErrNothingToRedo  = errors.New("layout: nothing to redo")
)

// Apply mutates the profile per op, increments the version, and returns the inverse
// op (computed from the pre-state) so an undo can restore the prior content
// (PROJ-215). It is deterministic and free of any transport coupling.
func (p *Profile) Apply(op Op) (Op, error) {
	switch op.Kind {
	case OpAddWidget:
		return p.applyAddWidget(op)
	case OpRemoveWidget:
		return p.applyRemoveWidget(op)
	case OpMoveWidget:
		return p.applyMoveWidget(op)
	case OpResizeWidget:
		return p.applyResizeWidget(op)
	case OpSetStyle, OpSetBinding, OpSetInteraction, OpSetConfig:
		return p.applySet(op)
	case OpChangeGrid:
		return p.applyChangeGrid(op)
	case OpAddPage:
		return p.applyAddPage(op)
	case OpRemovePage:
		return p.applyRemovePage(op)
	default:
		return Op{}, fmt.Errorf("%w: unknown kind %q", ErrBadOp, op.Kind)
	}
}

func (p *Profile) applyAddWidget(op Op) (Op, error) {
	pg := p.page(op.PageID)
	if pg == nil {
		return Op{}, fmt.Errorf("%w: %q", ErrPageNotFound, op.PageID)
	}
	if op.Widget == nil {
		return Op{}, fmt.Errorf("%w: AddWidget requires a widget", ErrBadOp)
	}
	w := op.Widget.clone()
	pg.Widgets = append(pg.Widgets, w)
	p.Version++
	return Op{Kind: OpRemoveWidget, PageID: op.PageID, WidgetID: w.ID}, nil
}

func (p *Profile) applyRemoveWidget(op Op) (Op, error) {
	pg := p.page(op.PageID)
	if pg == nil {
		return Op{}, fmt.Errorf("%w: %q", ErrPageNotFound, op.PageID)
	}
	idx := pg.widgetIndex(op.WidgetID)
	if idx < 0 {
		return Op{}, fmt.Errorf("%w: %q", ErrWidgetNotFound, op.WidgetID)
	}
	removed := pg.Widgets[idx].clone()
	pg.Widgets = append(pg.Widgets[:idx], pg.Widgets[idx+1:]...)
	p.Version++
	return Op{Kind: OpAddWidget, PageID: op.PageID, Widget: &removed}, nil
}

func (p *Profile) applyMoveWidget(op Op) (Op, error) {
	w, err := p.widget(op.PageID, op.WidgetID)
	if err != nil {
		return Op{}, err
	}
	if op.To == nil {
		return Op{}, fmt.Errorf("%w: MoveWidget requires a target", ErrBadOp)
	}
	prev := w.Placement
	w.Placement.Col = op.To.Col
	w.Placement.Row = op.To.Row
	p.Version++
	return Op{
		Kind: OpMoveWidget, PageID: op.PageID, WidgetID: op.WidgetID,
		To: &Placement{Col: prev.Col, Row: prev.Row},
	}, nil
}

func (p *Profile) applyResizeWidget(op Op) (Op, error) {
	w, err := p.widget(op.PageID, op.WidgetID)
	if err != nil {
		return Op{}, err
	}
	if op.To == nil {
		return Op{}, fmt.Errorf("%w: ResizeWidget requires a target", ErrBadOp)
	}
	prev := w.Placement
	w.Placement.ColSpan = op.To.ColSpan
	w.Placement.RowSpan = op.To.RowSpan
	p.Version++
	return Op{
		Kind: OpResizeWidget, PageID: op.PageID, WidgetID: op.WidgetID,
		To: &Placement{ColSpan: prev.ColSpan, RowSpan: prev.RowSpan},
	}, nil
}

func (p *Profile) applySet(op Op) (Op, error) {
	w, err := p.widget(op.PageID, op.WidgetID)
	if err != nil {
		return Op{}, err
	}
	inv := Op{Kind: op.Kind, PageID: op.PageID, WidgetID: op.WidgetID}
	switch op.Kind {
	case OpSetStyle:
		if w.Appearance == nil {
			w.Appearance = map[string]any{}
		}
		inv.Style = asMap(w.Appearance["style"])
		setOrDelete(w.Appearance, "style", op.Style)
	case OpSetBinding:
		if w.Appearance == nil {
			w.Appearance = map[string]any{}
		}
		inv.Binding = asStringPtr(w.Appearance["stateBinding"])
		if op.Binding == nil {
			delete(w.Appearance, "stateBinding")
		} else {
			w.Appearance["stateBinding"] = *op.Binding
		}
	case OpSetInteraction:
		inv.Interaction = w.Interaction
		w.Interaction = op.Interaction
	case OpSetConfig:
		inv.Config = w.Config
		w.Config = op.Config
	}
	p.Version++
	return inv, nil
}

func (p *Profile) applyChangeGrid(op Op) (Op, error) {
	pg := p.page(op.PageID)
	if pg == nil {
		return Op{}, fmt.Errorf("%w: %q", ErrPageNotFound, op.PageID)
	}
	prev := pg.Grid
	pg.Grid = op.Grid
	p.Version++
	return Op{Kind: OpChangeGrid, PageID: op.PageID, Grid: prev}, nil
}

func (p *Profile) applyAddPage(op Op) (Op, error) {
	if op.Page == nil {
		return Op{}, fmt.Errorf("%w: AddPage requires a page", ErrBadOp)
	}
	if p.page(op.Page.ID) != nil {
		return Op{}, fmt.Errorf("%w: page %q already exists", ErrBadOp, op.Page.ID)
	}
	page := *op.Page
	p.Pages = append(p.Pages, page)
	p.Version++
	return Op{Kind: OpRemovePage, PageID: page.ID}, nil
}

func (p *Profile) applyRemovePage(op Op) (Op, error) {
	for i := range p.Pages {
		if p.Pages[i].ID == op.PageID {
			removed := p.Pages[i]
			p.Pages = append(p.Pages[:i], p.Pages[i+1:]...)
			p.Version++
			return Op{Kind: OpAddPage, Page: &removed}, nil
		}
	}
	return Op{}, fmt.Errorf("%w: %q", ErrPageNotFound, op.PageID)
}

func (p *Profile) widget(pageID, widgetID string) (*Widget, error) {
	pg := p.page(pageID)
	if pg == nil {
		return nil, fmt.Errorf("%w: %q", ErrPageNotFound, pageID)
	}
	idx := pg.widgetIndex(widgetID)
	if idx < 0 {
		return nil, fmt.Errorf("%w: %q", ErrWidgetNotFound, widgetID)
	}
	return &pg.Widgets[idx], nil
}

func asMap(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return nil
}

func asStringPtr(v any) *string {
	if s, ok := v.(string); ok {
		return &s
	}
	return nil
}

func setOrDelete(m map[string]any, key string, val map[string]any) {
	if val == nil {
		delete(m, key)
	} else {
		m[key] = val
	}
}

// DocumentStore is the slice of the persistence layer the op-log needs (the
// `*persistence.DocumentRepo` satisfies it; tests inject an in-memory fake).
type DocumentStore interface {
	Load(ctx context.Context, id string) (persistence.Document, error)
	Update(ctx context.Context, d persistence.Document) error
}

// OpLog applies versioned ops to the authoritative documents and persists them,
// enforcing a single-writer edit lock per document (2C §4.3). It does not touch
// transport — PROJ-212 consumes the applied ops to broadcast.
type OpLog struct {
	store DocumentStore
	now   func() int64

	mu       sync.Mutex // serialises apply+persist
	locksMu  sync.Mutex
	locks    map[string]bool
}

// OpLogOption configures an OpLog.
type OpLogOption func(*OpLog)

// WithClock injects a timestamp source (unix millis) for tests.
func WithClock(now func() int64) OpLogOption {
	return func(l *OpLog) {
		if now != nil {
			l.now = now
		}
	}
}

// NewOpLog binds an op-log to a document store.
func NewOpLog(store DocumentStore, opts ...OpLogOption) *OpLog {
	l := &OpLog{
		store: store,
		now:   func() int64 { return time.Now().UnixMilli() },
		locks: make(map[string]bool),
	}
	for _, o := range opts {
		o(l)
	}
	return l
}

// AcquireEdit takes the single-writer edit lock for a document. A second acquire
// while the lock is held returns ok=false (one Designer edits a profile at a time,
// V1 — 2C §4.3). The returned release frees it.
func (l *OpLog) AcquireEdit(docID string) (release func(), ok bool) {
	l.locksMu.Lock()
	defer l.locksMu.Unlock()
	if l.locks[docID] {
		return nil, false
	}
	l.locks[docID] = true
	return func() {
		l.locksMu.Lock()
		delete(l.locks, docID)
		l.locksMu.Unlock()
	}, true
}

// Apply loads the document, applies the op (incrementing its version), and persists
// it. It returns the inverse op (for undo) and the new version. Apply+persist is
// atomic under the op-log mutex.
func (l *OpLog) Apply(ctx context.Context, docID string, op Op) (inverse Op, newVersion int, err error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	doc, err := l.store.Load(ctx, docID)
	if err != nil {
		return Op{}, 0, fmt.Errorf("layout: load %q: %w", docID, err)
	}
	profile, err := ParseProfile([]byte(doc.BodyJSON))
	if err != nil {
		return Op{}, 0, err
	}
	inverse, err = profile.Apply(op)
	if err != nil {
		return Op{}, 0, err
	}
	body, err := profile.JSON()
	if err != nil {
		return Op{}, 0, err
	}
	doc.Version = profile.Version
	doc.BodyJSON = string(body)
	doc.UpdatedAt = l.now()
	if err := l.store.Update(ctx, doc); err != nil {
		return Op{}, 0, fmt.Errorf("layout: persist %q: %w", docID, err)
	}
	return inverse, profile.Version, nil
}
