// Reduced-motion hook (CD-201): reflects the user's prefers-reduced-motion.
// Guards absent matchMedia (jsdom/SSR) → defaults to false (motion allowed).
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(QUERY)
    setReduced(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}
