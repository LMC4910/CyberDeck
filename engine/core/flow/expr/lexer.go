package expr

import (
	"fmt"
	"strconv"
	"strings"
)

type tokKind int

const (
	tNum tokKind = iota
	tStr
	tIdent
	tBool
	tOp // operators, parens, dot
	tEOF
)

type token struct {
	kind tokKind
	text string  // operator text / ident name / raw string value
	num  float64 // for tNum
	b    bool    // for tBool
	pos  int
}

// lex tokenises an expression. Only the safe vocabulary is recognised; any other
// rune is a lex error (no escape into arbitrary input).
func lex(src string) ([]token, error) {
	var out []token
	r := []rune(src)
	i := 0
	for i < len(r) {
		c := r[i]
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		case c >= '0' && c <= '9':
			j := i
			dot := false
			for j < len(r) && (r[j] >= '0' && r[j] <= '9' || (r[j] == '.' && !dot)) {
				if r[j] == '.' {
					dot = true
				}
				j++
			}
			n, err := strconv.ParseFloat(string(r[i:j]), 64)
			if err != nil {
				return nil, fmt.Errorf("expr: bad number %q", string(r[i:j]))
			}
			out = append(out, token{kind: tNum, num: n, pos: i})
			i = j
		case c == '\'' || c == '"':
			quote := c
			j := i + 1
			var sb strings.Builder
			for j < len(r) && r[j] != quote {
				sb.WriteRune(r[j])
				j++
			}
			if j >= len(r) {
				return nil, fmt.Errorf("expr: unterminated string at %d", i)
			}
			out = append(out, token{kind: tStr, text: sb.String(), pos: i})
			i = j + 1
		case isIdentStart(c):
			j := i
			for j < len(r) && isIdentPart(r[j]) {
				j++
			}
			name := string(r[i:j])
			switch name {
			case "true":
				out = append(out, token{kind: tBool, b: true, pos: i})
			case "false":
				out = append(out, token{kind: tBool, b: false, pos: i})
			default:
				out = append(out, token{kind: tIdent, text: name, pos: i})
			}
			i = j
		default:
			op, n, err := lexOp(r, i)
			if err != nil {
				return nil, err
			}
			out = append(out, token{kind: tOp, text: op, pos: i})
			i += n
		}
	}
	out = append(out, token{kind: tEOF, pos: i})
	return out, nil
}

func lexOp(r []rune, i int) (op string, n int, err error) {
	two := ""
	if i+1 < len(r) {
		two = string(r[i : i+2])
	}
	switch two {
	case "==", "!=", "<=", ">=", "&&", "||":
		return two, 2, nil
	}
	switch r[i] {
	case '+', '-', '*', '/', '%', '<', '>', '!', '(', ')', '.':
		return string(r[i]), 1, nil
	default:
		return "", 0, fmt.Errorf("expr: unexpected character %q at %d", string(r[i]), i)
	}
}

func isIdentStart(c rune) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isIdentPart(c rune) bool {
	return isIdentStart(c) || (c >= '0' && c <= '9')
}
