package state

// SubscriptionSet is the set of state IDs a session's current layout binds
// (2B §2.3). The store fans a delta to a session only if the state is in that
// session's subscription set (TB-ST-4) — fan-out (PROJ-150) owns the per-session
// loop; this type is the reusable filter primitive it builds on.
//
// SubscriptionSet is not safe for concurrent mutation; a session owns its own.
type SubscriptionSet struct {
	ids map[string]struct{}
}

// NewSubscriptionSet builds a set from the given state IDs.
func NewSubscriptionSet(ids ...string) *SubscriptionSet {
	s := &SubscriptionSet{ids: make(map[string]struct{}, len(ids))}
	for _, id := range ids {
		s.ids[id] = struct{}{}
	}
	return s
}

// Add adds an ID to the set.
func (s *SubscriptionSet) Add(id string) { s.ids[id] = struct{}{} }

// Remove removes an ID from the set.
func (s *SubscriptionSet) Remove(id string) { delete(s.ids, id) }

// Contains reports whether the ID is subscribed.
func (s *SubscriptionSet) Contains(id string) bool {
	_, ok := s.ids[id]
	return ok
}

// Len returns the number of subscribed IDs.
func (s *SubscriptionSet) Len() int { return len(s.ids) }

// Filter returns only the deltas whose state ID is in this set, preserving order.
func (s *SubscriptionSet) Filter(deltas []Delta) []Delta {
	out := make([]Delta, 0, len(deltas))
	for _, d := range deltas {
		if s.Contains(d.ID) {
			out = append(out, d)
		}
	}
	return out
}
