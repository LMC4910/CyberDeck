// Canonical, byte-stable JSON serialization — half of the CD-416 publish contract.
// The Go engine (CD-506) MUST reproduce these exact bytes when it re-implements the
// flatten, so this format is a spec, not an implementation detail.
//
// THE CONTRACT (state precisely — CD-506 matches this):
//   1. Object keys are emitted in ascending order of their UTF-16 code units
//      (JavaScript's default `Array.prototype.sort` on strings). For the ASCII-only
//      keys the layout document uses, this is identical to a byte-wise sort and to
//      Go's `sort.Strings`.
//   2. Indentation is two spaces per nesting depth; line endings are LF ("\n").
//   3. There is NO trailing newline.
//   4. An empty object serializes as "{}" and an empty array as "[]" (no interior
//      newline or space).
//   5. Scalars go through JSON.stringify:
//        - strings use standard JSON string escaping with NO HTML escaping
//          (i.e. `<`, `>`, `&` are emitted literally). Go must call
//          `Encoder.SetEscapeHTML(false)`.
//        - numbers use the JS Number→string algorithm. The flattener only ever
//          emits SAFE INTEGERS into the layout document, so every number is a plain
//          decimal integer with no sign-of-zero, decimal point, or exponent.
//   6. Object properties whose value is `undefined` are omitted entirely (they are
//      never serialized, and never coerced to null). Array holes / explicit
//      `undefined` array elements are coerced to `null` (JSON has no undefined).
//
// The function is pure: same input value → same output string, always.

export function canonicalStringify(value: unknown): string {
  return writeValue(value, '')
}

function writeValue(value: unknown, indent: string): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return writeArray(value, indent)
  if (typeof value === 'object') return writeObject(value as Record<string, unknown>, indent)
  // string | number | boolean
  return JSON.stringify(value)
}

function writeArray(arr: readonly unknown[], indent: string): string {
  if (arr.length === 0) return '[]'
  const inner = indent + '  '
  const items = arr.map((v) => inner + writeValue(v, inner))
  return '[\n' + items.join(',\n') + '\n' + indent + ']'
}

function writeObject(obj: Record<string, unknown>, indent: string): string {
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  if (keys.length === 0) return '{}'
  const inner = indent + '  '
  const entries = keys.map((k) => inner + JSON.stringify(k) + ': ' + writeValue(obj[k], inner))
  return '{\n' + entries.join(',\n') + '\n' + indent + '}'
}
