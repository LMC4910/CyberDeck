package expr

import "fmt"

// Parse lexes + parses an expression into an AST, rejecting any malformed or
// trailing input. There is no call/assignment/statement syntax, so a parsed AST
// can only ever read tokens and compute — never execute.
func Parse(src string) (Expr, error) {
	toks, err := lex(src)
	if err != nil {
		return nil, err
	}
	p := &parser{toks: toks}
	e, err := p.parseOr()
	if err != nil {
		return nil, err
	}
	if p.cur().kind != tEOF {
		return nil, fmt.Errorf("expr: unexpected trailing token %q", p.cur().text)
	}
	return e, nil
}

type parser struct {
	toks []token
	pos  int
}

func (p *parser) cur() token { return p.toks[p.pos] }

func (p *parser) advance() token {
	t := p.toks[p.pos]
	if p.pos < len(p.toks)-1 {
		p.pos++
	}
	return t
}

func (p *parser) isOp(s string) bool {
	return p.cur().kind == tOp && p.cur().text == s
}

// binary precedence levels, lowest first.
func (p *parser) parseOr() (Expr, error)  { return p.binary(p.parseAnd, "||") }
func (p *parser) parseAnd() (Expr, error) { return p.binary(p.parseEquality, "&&") }
func (p *parser) parseEquality() (Expr, error) {
	return p.binary(p.parseComparison, "==", "!=")
}
func (p *parser) parseComparison() (Expr, error) {
	return p.binary(p.parseTerm, "<", "<=", ">", ">=")
}
func (p *parser) parseTerm() (Expr, error)   { return p.binary(p.parseFactor, "+", "-") }
func (p *parser) parseFactor() (Expr, error) { return p.binary(p.parseUnary, "*", "/", "%") }

// binary parses a left-associative level: next (op next)*.
func (p *parser) binary(next func() (Expr, error), ops ...string) (Expr, error) {
	l, err := next()
	if err != nil {
		return nil, err
	}
	for {
		matched := ""
		for _, op := range ops {
			if p.isOp(op) {
				matched = op
				break
			}
		}
		if matched == "" {
			return l, nil
		}
		p.advance()
		r, err := next()
		if err != nil {
			return nil, err
		}
		l = Binary{Op: matched, L: l, R: r}
	}
}

func (p *parser) parseUnary() (Expr, error) {
	if p.isOp("!") || p.isOp("-") {
		op := p.advance().text
		x, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return Unary{Op: op, X: x}, nil
	}
	return p.parsePrimary()
}

func (p *parser) parsePrimary() (Expr, error) {
	t := p.cur()
	switch t.kind {
	case tNum:
		p.advance()
		return Literal{Value: t.num}, nil
	case tStr:
		p.advance()
		return Literal{Value: t.text}, nil
	case tBool:
		p.advance()
		return Literal{Value: t.b}, nil
	case tIdent:
		p.advance()
		name := t.text
		for p.isOp(".") {
			p.advance()
			if p.cur().kind != tIdent {
				return nil, fmt.Errorf("expr: expected identifier after '.'")
			}
			name += "." + p.advance().text
		}
		return Ident{Name: name}, nil
	case tOp:
		if t.text == "(" {
			p.advance()
			e, err := p.parseOr()
			if err != nil {
				return nil, err
			}
			if !p.isOp(")") {
				return nil, fmt.Errorf("expr: expected ')'")
			}
			p.advance()
			return e, nil
		}
		return nil, fmt.Errorf("expr: unexpected operator %q", t.text)
	default:
		return nil, fmt.Errorf("expr: unexpected end of input")
	}
}
