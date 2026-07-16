// Expression parser (CD-323). Recursive-descent with precedence climbing → an AST.
// Grammar (no assignment, no statements): ternary → || → && → equality → comparison
// → additive → multiplicative → unary → primary (literal / var-path / call / group).
import { tokenize, ExprError, type Token } from './lexer'

export type Ast =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'var'; path: string }
  | { t: 'unary'; op: string; e: Ast }
  | { t: 'bin'; op: string; l: Ast; r: Ast }
  | { t: 'logic'; op: '&&' | '||'; l: Ast; r: Ast }
  | { t: 'ternary'; c: Ast; a: Ast; b: Ast }
  | { t: 'call'; name: string; args: Ast[] }

class Parser {
  private i = 0
  private readonly toks: Token[]
  constructor(toks: Token[]) {
    this.toks = toks
  }

  private peek(): Token {
    return this.toks[this.i]!
  }
  private next(): Token {
    return this.toks[this.i++]!
  }
  private expect(type: Token['type']): Token {
    const t = this.next()
    if (t.type !== type) throw new ExprError(`expected ${type} but found '${t.value || 'end of input'}'`)
    return t
  }

  parse(): Ast {
    if (this.peek().type === 'eof') throw new ExprError('empty expression')
    const e = this.ternary()
    if (this.peek().type !== 'eof') throw new ExprError(`unexpected '${this.peek().value}'`)
    return e
  }

  private ternary(): Ast {
    const c = this.or()
    if (this.peek().type === 'question') {
      this.next()
      const a = this.ternary()
      this.expect('colon')
      const b = this.ternary()
      return { t: 'ternary', c, a, b }
    }
    return c
  }

  private or(): Ast {
    let l = this.and()
    while (this.peek().type === 'op' && this.peek().value === '||') {
      this.next()
      l = { t: 'logic', op: '||', l, r: this.and() }
    }
    return l
  }
  private and(): Ast {
    let l = this.equality()
    while (this.peek().type === 'op' && this.peek().value === '&&') {
      this.next()
      l = { t: 'logic', op: '&&', l, r: this.equality() }
    }
    return l
  }
  private equality(): Ast {
    let l = this.comparison()
    while (this.peek().type === 'op' && ['==', '!=', '===', '!=='].includes(this.peek().value)) {
      const op = this.next().value
      l = { t: 'bin', op, l, r: this.comparison() }
    }
    return l
  }
  private comparison(): Ast {
    let l = this.additive()
    while (this.peek().type === 'op' && ['<', '<=', '>', '>='].includes(this.peek().value)) {
      const op = this.next().value
      l = { t: 'bin', op, l, r: this.additive() }
    }
    return l
  }
  private additive(): Ast {
    let l = this.multiplicative()
    while (this.peek().type === 'op' && ['+', '-'].includes(this.peek().value)) {
      const op = this.next().value
      l = { t: 'bin', op, l, r: this.multiplicative() }
    }
    return l
  }
  private multiplicative(): Ast {
    let l = this.unary()
    while (this.peek().type === 'op' && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.next().value
      l = { t: 'bin', op, l, r: this.unary() }
    }
    return l
  }
  private unary(): Ast {
    if (this.peek().type === 'op' && ['-', '!'].includes(this.peek().value)) {
      const op = this.next().value
      return { t: 'unary', op, e: this.unary() }
    }
    return this.primary()
  }

  private primary(): Ast {
    const t = this.peek()
    if (t.type === 'number') { this.next(); return { t: 'num', v: Number(t.value) } }
    if (t.type === 'string') { this.next(); return { t: 'str', v: t.value } }
    if (t.type === 'lparen') {
      this.next()
      const e = this.ternary()
      this.expect('rparen')
      return e
    }
    if (t.type === 'ident') {
      this.next()
      if (t.value === 'true') return { t: 'bool', v: true }
      if (t.value === 'false') return { t: 'bool', v: false }
      if (t.value === 'null') return { t: 'null' }
      // function call?
      if (this.peek().type === 'lparen') {
        this.next()
        const args: Ast[] = []
        if (this.peek().type !== 'rparen') {
          args.push(this.ternary())
          while (this.peek().type === 'comma') {
            this.next()
            args.push(this.ternary())
          }
        }
        this.expect('rparen')
        return { t: 'call', name: t.value, args }
      }
      // dotted variable path: ident ('.' ident)*
      let path = t.value
      while (this.peek().type === 'dot') {
        this.next()
        const seg = this.expect('ident')
        path += '.' + seg.value
      }
      return { t: 'var', path }
    }
    throw new ExprError(`unexpected '${t.value || 'end of input'}'`)
  }
}

export function parse(src: string): Ast {
  return new Parser(tokenize(src)).parse()
}
