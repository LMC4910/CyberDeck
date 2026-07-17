// Expression lexer (CD-323). Turns source into tokens; rejects illegal characters
// (backtick, semicolon, bare '=', etc.) so injection/malformed input fails early.
// No `eval`, no Function — this is a hand-written tokenizer.

export type TokenType =
  | 'number'
  | 'string'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'dot'
  | 'question'
  | 'colon'
  | 'eof'

export interface Token {
  type: TokenType
  value: string
  pos: number
}

export class ExprError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExprError'
  }
}

const OPS_3 = ['===', '!==']
const OPS_2 = ['==', '!=', '<=', '>=', '&&', '||']
const OPS_1 = ['+', '-', '*', '/', '%', '<', '>', '!']

export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]!
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    // string literal
    if (c === '"' || c === "'") {
      const quote = c
      let j = i + 1
      let str = ''
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) {
          // Translate the common escapes; any other escaped char is itself
          // (so \" and \\ work and nothing new becomes reachable).
          const e = src[j + 1]!
          str += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e
          j += 2
        } else {
          str += src[j]
          j++
        }
      }
      if (j >= n) throw new ExprError('unterminated string literal')
      tokens.push({ type: 'string', value: str, pos: i })
      i = j + 1
      continue
    }
    // number
    if (c >= '0' && c <= '9') {
      let j = i
      while (j < n && src[j]! >= '0' && src[j]! <= '9') j++
      if (src[j] === '.') {
        j++
        while (j < n && src[j]! >= '0' && src[j]! <= '9') j++
      }
      tokens.push({ type: 'number', value: src.slice(i, j), pos: i })
      i = j
      continue
    }
    // identifier
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < n && /[a-zA-Z0-9_]/.test(src[j]!)) j++
      tokens.push({ type: 'ident', value: src.slice(i, j), pos: i })
      i = j
      continue
    }
    // punctuation
    if (c === '(') { tokens.push({ type: 'lparen', value: c, pos: i }); i++; continue }
    if (c === ')') { tokens.push({ type: 'rparen', value: c, pos: i }); i++; continue }
    if (c === ',') { tokens.push({ type: 'comma', value: c, pos: i }); i++; continue }
    if (c === '.') { tokens.push({ type: 'dot', value: c, pos: i }); i++; continue }
    if (c === '?') { tokens.push({ type: 'question', value: c, pos: i }); i++; continue }
    if (c === ':') { tokens.push({ type: 'colon', value: c, pos: i }); i++; continue }
    // operators (longest match first)
    const three = src.slice(i, i + 3)
    if (OPS_3.includes(three)) { tokens.push({ type: 'op', value: three, pos: i }); i += 3; continue }
    const two = src.slice(i, i + 2)
    if (OPS_2.includes(two)) { tokens.push({ type: 'op', value: two, pos: i }); i += 2; continue }
    if (OPS_1.includes(c)) { tokens.push({ type: 'op', value: c, pos: i }); i++; continue }
    // '=' alone (assignment) and anything else is illegal
    throw new ExprError(`unexpected character '${c}'`)
  }
  tokens.push({ type: 'eof', value: '', pos: n })
  return tokens
}
