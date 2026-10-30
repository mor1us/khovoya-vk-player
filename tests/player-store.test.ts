import { describe, it, expect, vi } from 'vitest'
import { createPlayer } from '../src/renderer/store/player'
import type { Track } from '../src/shared/types'

const tr = (i: number, url = 'https://u/' + i): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist: 'A' + i, duration: 200, url, available: true })
const list = [0, 1, 2, 3].map((i) => tr(i))

function memStorage() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }
function fakeEngine() {
  return {
    load: vi.fn(async (_u: string, _s?: number) => {}), play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setVolume: vi.fn(),
    crossfadeTo: vi.fn(async () => {}), onTimeUpdate: vi.fn(), onEnded: vi.fn(), onError: vi.fn(),
    paused: true, time: 0, duration: 200
  }
}
function make(over: Record<string, unknown> = {}) {
  const engine = fakeEngine(); const storage = memStorage()
  const p = createPlayer({ engine: engine as any, storage, resolveUrl: async (t) => t.url, refreshUrl: async () => '', crossfadeSec: () => 6, ...over })
  return { p, engine, storage }
}

describe('player store', () => {
  it('playList starts the chosen track', async () => {
    const { p, engine } = make()
    await p.getState().playList(list, 't2', 'mine')
    expect(p.getState().current?.id).toBe('t2')
    expect(p.getState().playing).toBe(true)
    expect(engine.load).toHaveBeenCalledWith('https://u/2', 0)
  })
  it('manual next crossfades 0.3 s', async () => {
    const { p, engine } = make()
    await p.getState().playList(list, 't0', 'mine')
    await p.getState().next()
    expect(engine.crossfadeTo).toHaveBeenCalledWith('https://u/1', 0.3)
    expect(p.getState().current?.id).toBe('t1')
  })
  it('auto crossfade starts at duration-6', async () => {
    const { p, engine } = make()
    await p.getState().playList(list, 't0', 'mine')
    const tick = engine.onTimeUpdate.mock.calls[0][0]
    tick(100, 200); await Promise.resolve()
    expect(engine.crossfadeTo).not.toHaveBeenCalled()
    tick(194.1, 200); tick(194.4, 200); await new Promise((r) => setTimeout(r, 0))
    expect(engine.crossfadeTo).toHaveBeenCalledWith('https://u/1', 6)
    expect(engine.crossfadeTo).toHaveBeenCalledTimes(1)
    expect(p.getState().current?.id).toBe('t1')
  })
  it('without crossfade, ended loads next', async () => {
    const { p, engine } = make({ crossfadeSec: () => 0 })
    await p.getState().playList(list, 't0', 'mine')
    engine.onEnded.mock.calls[0][0](); await new Promise((r) => setTimeout(r, 0))
    expect(p.getState().current?.id).toBe('t1')
    expect(engine.load).toHaveBeenLastCalledWith('https://u/1', 0)
  })
  it('dead link with failed refresh skips to the next track and notifies', async () => {
    const onNotice = vi.fn()
    const { p, engine } = make({ onNotice })
    engine.load.mockImplementation(async (u: string) => { if (u.endsWith('/1')) throw new Error('x') })
    await p.getState().playList(list, 't1', 'mine')
    expect(p.getState().current?.id).toBe('t2')
    expect(onNotice).toHaveBeenCalled()
  })
  it('persists and restores on pause with same track and position', async () => {
    const { p, storage } = make()
    await p.getState().playList(list, 't2', 'pl:1')
    p.setState({ position: 42 })
    p.getState().persist()
    const { p: p2 } = make({ storage })
    p2.getState().restore()
    expect(p2.getState().current?.id).toBe('t2')
    expect(p2.getState().playing).toBe(false)
    expect(p2.getState().position).toBe(42)
    expect(p2.getState().source).toBe('pl:1')
  })
  it('keeps the last 200 played ids in recent', async () => {
    const { p, storage } = make()
    await p.getState().playList(list, 't0', 'mine')
    await p.getState().next()
    expect(JSON.parse(storage.getItem('recent')!)).toEqual(['t1', 't0'])
  })
  it('reports track changes with listened seconds', async () => {
    const onChange = vi.fn()
    const { p, engine } = make({ onTrackChange: onChange })
    await p.getState().playList(list, 't0', 'mine')
    engine.onTimeUpdate.mock.calls[0][0](12, 200)
    await p.getState().next()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 't0' }), expect.objectContaining({ id: 't1' }), { listened: 12, manual: true })
  })
  it('stops after 3 dead tracks in a row instead of skipping the whole queue', async () => {
    const onNotice = vi.fn()
    const many = Array.from({ length: 10 }, (_, i) => tr(i))
    const { p, engine } = make({ onNotice })
    engine.load.mockRejectedValue(new Error('dead'))
    await p.getState().playList(many, 't0', 'mine')
    expect(engine.load.mock.calls.length).toBeLessThanOrEqual(3)
    expect(p.getState().playing).toBe(false)
    expect(onNotice).toHaveBeenLastCalledWith('Не получается включить треки. Проверь интернет или войди в ВК заново.')
  })
})
