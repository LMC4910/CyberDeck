import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { createStore, useStore } from '@/stores'

describe('useStore — selector memoization (render count)', () => {
  it('re-renders only when the selected slice changes', () => {
    const store = createStore({ a: 1, b: 100 }, { name: 't', kind: 'temp' })
    let renders = 0

    function AView() {
      renders++
      const a = useStore(store, (s) => s.a)
      return <span>a={a}</span>
    }

    const { getByText } = renderWithProviders(<AView />)
    expect(renders).toBe(1)
    expect(getByText('a=1')).toBeInTheDocument()

    // Update an UNRELATED slice (b) → no re-render.
    act(() => store.setState((s) => ({ ...s, b: 200 })))
    expect(renders).toBe(1)

    // Update the SELECTED slice (a) → one re-render.
    act(() => store.setState((s) => ({ ...s, a: 2 })))
    expect(renders).toBe(2)
    expect(getByText('a=2')).toBeInTheDocument()
  })

  it('supports a custom equality function for object slices', () => {
    const store = createStore({ list: [1, 2] }, { name: 't2', kind: 'temp' })
    let renders = 0
    const shallowArrayEq = (x: number[], y: number[]) =>
      x.length === y.length && x.every((v, i) => v === y[i])

    function ListView() {
      renders++
      const list = useStore(store, (s) => s.list, shallowArrayEq)
      return <span>{list.join(',')}</span>
    }

    renderWithProviders(<ListView />)
    expect(renders).toBe(1)
    // set an equal-by-value (but new-reference) array → no re-render
    act(() => store.setState({ list: [1, 2] }))
    expect(renders).toBe(1)
    act(() => store.setState({ list: [1, 2, 3] }))
    expect(renders).toBe(2)
  })
})
