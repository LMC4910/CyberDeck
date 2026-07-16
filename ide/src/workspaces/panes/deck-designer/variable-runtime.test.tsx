import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { VariableRuntime } from '@/stores'
import { Board } from './board'
import { VariableRuntimeProvider, widgetDependencies, resolveBinding } from './use-variable-runtime'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'stat.readout', frame: { x, y: 0, w: 60, h: 40 } }
}

function doc(): ProjectModel {
  const m = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'R' },
    pages: [{ id: 'page_rttest', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_cpu000', 0), w('w_fps000', 100), w('w_plain0', 200)] }],
  })
  m.setBinding('w_cpu000', 'value', { mode: 'variable', src: 'system.cpu.percent' })
  m.setBinding('w_fps000', 'value', { mode: 'expression', expr: 'fps.current / 2' })
  return m
}

describe('binding runtime (CD-326)', () => {
  it('a tick updates EXACTLY the widgets depending on that variable (render-count)', () => {
    const model = doc()
    const runtime = new VariableRuntime({ 'system.cpu.percent': 40, 'fps.current': 120 })
    const renders = new Map<string, number>()
    const onWidgetRender = (id: string) => renders.set(id, (renders.get(id) ?? 0) + 1)

    render(
      <VariableRuntimeProvider value={runtime}>
        <Board model={model} pageId="page_rttest" onWidgetRender={onWidgetRender} />
      </VariableRuntimeProvider>,
    )
    expect([...renders.values()]).toEqual([1, 1, 1]) // one paint each on mount

    // Tick CPU → only w_cpu000 re-renders.
    act(() => runtime.tick('system.cpu.percent', 55))
    expect(renders.get('w_cpu000')).toBe(2)
    expect(renders.get('w_fps000')).toBe(1)
    expect(renders.get('w_plain0')).toBe(1)

    // Tick FPS → only the expression-bound w_fps000 re-renders.
    act(() => runtime.tick('fps.current', 90))
    expect(renders.get('w_fps000')).toBe(2)
    expect(renders.get('w_cpu000')).toBe(2)
    expect(renders.get('w_plain0')).toBe(1)

    // Tick an unrelated variable → nothing re-renders.
    act(() => runtime.tick('audio.volume', 0.5))
    expect([...renders.values()]).toEqual([2, 2, 1])
  })

  it('the bound value is displayed and follows ticks', () => {
    const model = doc()
    const runtime = new VariableRuntime({ 'system.cpu.percent': 40 })
    const { container } = render(
      <VariableRuntimeProvider value={runtime}>
        <Board model={model} pageId="page_rttest" />
      </VariableRuntimeProvider>,
    )
    expect(container.querySelector('[data-testid="live-w_cpu000"]')).toHaveTextContent('40')
    act(() => runtime.tick('system.cpu.percent', 77))
    expect(container.querySelector('[data-testid="live-w_cpu000"]')).toHaveTextContent('77')
  })

  it('widgetDependencies covers variable src + expression vars', () => {
    const model = doc()
    expect(widgetDependencies(model, 'w_cpu000')).toEqual(['system.cpu.percent'])
    expect(widgetDependencies(model, 'w_fps000')).toEqual(['fps.current'])
    expect(widgetDependencies(model, 'w_plain0')).toEqual([])
  })

  it('resolveBinding evaluates each mode against the live runtime', () => {
    const runtime = new VariableRuntime({ 'fps.current': 120 })
    expect(resolveBinding(runtime, { mode: 'variable', src: 'fps.current' })).toBe(120)
    expect(resolveBinding(runtime, { mode: 'expression', expr: 'fps.current / 4' })).toBe(30)
    expect(resolveBinding(runtime, { mode: 'static', val: { v: 'hi' } })).toBe('hi')
  })
})
