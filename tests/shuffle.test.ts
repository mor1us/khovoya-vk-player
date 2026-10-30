import { describe, it, expect } from 'vitest'
import { smartShuffle, fisherYates, cryptoRandom } from '../src/renderer/player/shuffle'
import type { Track } from '../src/shared/types'

const tr = (i: number, artist = 'A' + i): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist, duration: 100, url: 'u', available: true })

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 } }

describe('fisherYates', () => {
  it('is uniform: every element at every position ≈25% over 100k runs', () => {
    const rnd = seeded(1)
    const counts = Array.from({ length: 4 }, () => [0, 0, 0, 0])
    for (let n = 0; n < 100_000; n++) fisherYates([0, 1, 2, 3], rnd).forEach((v, pos) => counts[v][pos]++)
    for (const row of counts) for (const c of row) expect(Math.abs(c / 100_000 - 0.25)).toBeLessThan(0.02)
  })
  it('cryptoRandom is in [0,1)', () => { for (let i = 0; i < 1000; i++) { const r = cryptoRandom(); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(1) } })
})

describe('smartShuffle', () => {
  const list = Array.from({ length: 50 }, (_, i) => tr(i, 'Artist' + (i % 10)))
  const adj = (xs: Track[]) => xs.slice(1).filter((t, i) => t.artist === xs[i].artist).length

  it('keeps all tracks exactly once', () => {
    const out = smartShuffle(list, { recent: [], rnd: seeded(3) })
    expect(out.map((t) => t.id).sort()).toEqual(list.map((t) => t.id).sort())
  })
  it('spreads artists: no same-artist neighbours in ≥95% of 1000 runs, mean < 1', () => {
    const rnd = seeded(7); let clean = 0; let total = 0
    for (let n = 0; n < 1000; n++) { const a = adj(smartShuffle(list, { recent: [], rnd })); total += a; if (a === 0) clean++ }
    expect(clean / 1000).toBeGreaterThanOrEqual(0.95)
    expect(total / 1000).toBeLessThan(1)
  })
  it('puts recent tracks at the end in their recent order', () => {
    const out = smartShuffle(list, { recent: ['t5', 't9', 't0'], rnd: seeded(2) })
    expect(out.slice(-3).map((t) => t.id)).toEqual(['t5', 't9', 't0'])
  })
  it('puts firstId at position 0 even if it is recent', () => {
    const out = smartShuffle(list, { recent: ['t5'], firstId: 't5', rnd: seeded(2) })
    expect(out[0].id).toBe('t5')
    expect(out.length).toBe(50)
  })
  it('different seeds give different orders', () => {
    const a = smartShuffle(list, { recent: [], rnd: seeded(10) }).map((t) => t.id).join()
    const b = smartShuffle(list, { recent: [], rnd: seeded(11) }).map((t) => t.id).join()
    expect(a).not.toBe(b)
  })
  it('handles empty and single', () => {
    expect(smartShuffle([], { recent: [] })).toEqual([])
    expect(smartShuffle([tr(1)], { recent: [] }).length).toBe(1)
  })
})
