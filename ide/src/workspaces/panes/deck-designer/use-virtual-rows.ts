// Windowed list virtualization (CD-310). Given a total row count + fixed row height,
// returns only the slice of rows overlapping the scroll viewport (plus overscan), so
// a 1 000-layer tree mounts ~20 DOM nodes, not 1 000. Deliberately dependency-free.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export interface VirtualWindow {
  start: number
  end: number
  offsetY: number
  totalHeight: number
  onScroll: (e: { currentTarget: HTMLElement }) => void
  containerRef: (el: HTMLElement | null) => void
}

const DEFAULT_VIEWPORT = 480

export function useVirtualRows(total: number, rowHeight: number, overscan = 4): VirtualWindow {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const elRef = useRef<HTMLElement | null>(null)

  const containerRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el
    if (el && el.clientHeight > 0) setViewport(el.clientHeight)
  }, [])

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    if (el.clientHeight > 0) setViewport(el.clientHeight)
    if (typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0) setViewport(el.clientHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback((e: { currentTarget: HTMLElement }) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(total, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)

  return { start, end, offsetY: start * rowHeight, totalHeight: total * rowHeight, onScroll, containerRef }
}
