// Stable-ID allocation (CD-302 / AUDIT C3). Every entity in a cyberdeck.project is
// keyed by an opaque id matching the schema pattern
//   ^[a-z][a-z0-9]*_[a-z0-9][a-z0-9-]{5,}$
// i.e. a lowercase prefix (a readability hint only — NO semantics), an underscore,
// then ≥6 chars of [a-z0-9-] starting alnum. IDs are:
//   • never derived from display names (renaming never touches a key), and
//   • never reused after deletion / never regenerated on load.
// The random source is injectable so tests can make allocation deterministic.

const ID_RE = /^[a-z][a-z0-9]*_[a-z0-9][a-z0-9-]{5,}$/

export function isStableId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value)
}

export type RandomSource = () => number

function defaultRandom(): number {
  // crypto when available (browser/node) for collision resistance; Math.random
  // fallback keeps the module usable in any environment. Not security-sensitive.
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1)
    c.getRandomValues(buf)
    return buf[0]! / 0x1_0000_0000
  }
  return Math.random()
}

/** Allocates unique stable IDs. One instance per document keeps a live/dead set so
 *  an id is never reused even across delete→recreate within a session. */
export class IdAllocator {
  private readonly issued = new Set<string>()
  private readonly random: RandomSource

  constructor(random: RandomSource = defaultRandom, seedIssued: Iterable<string> = []) {
    this.random = random
    for (const id of seedIssued) this.issued.add(id)
  }

  /** Reserve an existing id (e.g. when restoring a document) so it is never reissued. */
  reserve(id: string): void {
    this.issued.add(id)
  }

  has(id: string): boolean {
    return this.issued.has(id)
  }

  /** Mint a fresh id with the given prefix (a-z only). */
  next(prefix: string): string {
    if (!/^[a-z][a-z0-9]*$/.test(prefix)) {
      throw new Error(`invalid id prefix: ${prefix}`)
    }
    for (let attempt = 0; attempt < 1000; attempt++) {
      const body = Math.floor(this.random() * 0xffffffff)
        .toString(36)
        .padStart(7, '0')
        .slice(0, 8)
      const id = `${prefix}_${body}`
      if (ID_RE.test(id) && !this.issued.has(id)) {
        this.issued.add(id)
        return id
      }
    }
    throw new Error('exhausted id allocation attempts')
  }
}

/** Standard prefixes so ids read nicely in dev tools (semantics still opaque). */
export const ID_PREFIX = {
  page: 'page',
  widget: 'w',
  group: 'grp',
  component: 'cmp',
  variant: 'var',
  device: 'dev',
  asset: 'ast',
} as const
