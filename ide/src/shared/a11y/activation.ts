// Keyboard activation helper (CD-201): invoke a handler on Enter/Space, matching
// native button semantics for elements that aren't native buttons.
import type { KeyboardEvent } from 'react'

/** onKeyDown handler that fires `run` on Enter or Space (and prevents scroll). */
export function activateOnKey<T extends HTMLElement>(run: () => void) {
  return (e: KeyboardEvent<T>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      run()
    }
  }
}
