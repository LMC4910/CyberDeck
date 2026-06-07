package registry

import "sort"

// The query API backs the designer's pickers (P1-AC-10): "all actions in category
// X", "all widgets accepting scalar states", etc. All queries return copies-by-value
// and are safe for concurrent use.

// Action returns the action descriptor by id.
func (r *Registry) Action(id string) (ActionDescriptor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	a, ok := r.actions[id]
	return a, ok
}

// ActionsByCategory returns all actions in a category, sorted by id.
func (r *Registry) ActionsByCategory(category string) []ActionDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []ActionDescriptor
	for _, a := range r.actions {
		if a.Category == category {
			out = append(out, a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// AllActions returns every action, sorted by id.
func (r *Registry) AllActions() []ActionDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ActionDescriptor, 0, len(r.actions))
	for _, a := range r.actions {
		out = append(out, a)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// Widget returns the widget descriptor by type.
func (r *Registry) Widget(typ string) (WidgetDescriptor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	w, ok := r.widgets[typ]
	return w, ok
}

// WidgetsAcceptingKind returns widgets that can bind a state of the given kind,
// sorted by type.
func (r *Registry) WidgetsAcceptingKind(kind string) []WidgetDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []WidgetDescriptor
	for _, w := range r.widgets {
		if w.acceptsKind(kind) {
			out = append(out, w)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Type < out[j].Type })
	return out
}

// AllWidgets returns every widget, sorted by type.
func (r *Registry) AllWidgets() []WidgetDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]WidgetDescriptor, 0, len(r.widgets))
	for _, w := range r.widgets {
		out = append(out, w)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Type < out[j].Type })
	return out
}

// FlowNode returns the flow-node descriptor by kind.
func (r *Registry) FlowNode(kind string) (FlowNodeDescriptor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	f, ok := r.flowNodes[kind]
	return f, ok
}

// AllFlowNodes returns every flow-node, sorted by kind.
func (r *Registry) AllFlowNodes() []FlowNodeDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]FlowNodeDescriptor, 0, len(r.flowNodes))
	for _, f := range r.flowNodes {
		out = append(out, f)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Kind < out[j].Kind })
	return out
}
