// Package expr is CyberDeck's sandboxed expression language for flow conditions and
// computed values (2D §5 / ADR-0013). It is a deliberately tiny, typed language
// over states (PROJ-160) + vars (PROJ-164): arithmetic, comparison, boolean, and
// dotted state tokens — and NOTHING else. There is no function-call syntax, no I/O,
// no host callbacks, and no reflection, so there is no code-execution path: this is
// a security boundary, evaluated carefully. An unavailable token resolves to a safe
// default (nil → comparisons are false) and never panics; a genuine type mismatch
// is returned as an error, never a panic.
package expr

// Expr is an AST node.
type Expr interface{ isExpr() }

// Literal is a number (float64), string, or bool.
type Literal struct{ Value any }

// Ident is a (possibly dotted) state/var token, e.g. "system.cpu.percent".
type Ident struct{ Name string }

// Unary is `!x` or `-x`.
type Unary struct {
	Op string
	X  Expr
}

// Binary is `l <op> r`.
type Binary struct {
	Op   string
	L, R Expr
}

func (Literal) isExpr() {}
func (Ident) isExpr()   {}
func (Unary) isExpr()   {}
func (Binary) isExpr()  {}
