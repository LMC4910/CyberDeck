// Focus management primitives (CD-201): focusable discovery, focus trap, and
// focus restore. Used by the Dialog primitive and any overlay (palette, prefs).
import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Visible, focusable descendants of a container in DOM order. Uses attribute-based
 * hidden checks (not offsetParent) so it works in jsdom, which has no layout.
 */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute('hidden') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      el.closest('[hidden]') === null,
  )
}

/**
 * Trap Tab focus within `ref`'s element while `active`. Cycles at both ends and
 * restores focus to the previously-focused element when deactivated/unmounted.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // move focus into the trap
    const focusables = getFocusable(container)
    ;(focusables[0] ?? container).focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = getFocusable(container)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const activeEl = document.activeElement
      if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [ref, active])
}

/** Capture the active element on mount and restore it on unmount. */
export function useFocusRestore(): void {
  const previous = useRef<HTMLElement | null>(null)
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null
    return () => {
      previous.current?.focus?.()
    }
  }, [])
}
