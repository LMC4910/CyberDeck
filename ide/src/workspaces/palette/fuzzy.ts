// Fuzzy scorer for the command palette (CD-206). Subsequence match with bonuses
// for consecutive hits and word-start hits; returns null when the query is not a
// subsequence of the text. An empty query matches everything (neutral score).

export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()
  if (q === '') return 0

  let qi = 0
  let score = 0
  let lastMatch = -2
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += ti === lastMatch + 1 ? 3 : 1 // consecutive-run bonus
      const prev = t[ti - 1]
      if (ti === 0 || prev === ' ' || prev === '.' || prev === '-') score += 2 // word-start bonus
      lastMatch = ti
      qi++
    }
  }
  if (qi < q.length) return null // not all query chars matched
  // slight penalty for later first match / longer text
  return score - lastMatch * 0.01
}

export interface Scored<T> {
  item: T
  score: number
}

/** Filter + sort items by fuzzy score against `key(item)`; empty query keeps order. */
export function fuzzyFilter<T>(query: string, items: T[], key: (item: T) => string): Scored<T>[] {
  const out: Scored<T>[] = []
  for (const item of items) {
    const score = fuzzyScore(query, key(item))
    if (score !== null) out.push({ item, score })
  }
  if (query.trim() !== '') out.sort((a, b) => b.score - a.score)
  return out
}
