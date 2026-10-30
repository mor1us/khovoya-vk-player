import { describe, it, expect } from 'vitest'
import { forgottenFavs } from '../src/renderer/wave/mixes'
import type { Track } from '../src/shared/types'

const tr = (i: number, artist = 'A' + (i % 10), available = true): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist, duration: 100, url: 'u', available })
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 } }

describe('forgottenFavs', () => {
  const mine = Array.from({ length: 100 }, (_, i) => tr(i))
  it('skips recently played and unavailable, returns n unique', () => {
    const recent = mine.slice(0, 50).map((t) => t.id)
    const out = forgottenFavs([...mine, tr(500, 'Z', false)], recent, 30, seeded(1))
    expect(out.length).toBe(30)
    expect(out.some((t) => recent.includes(t.id) || t.id === 't500')).toBe(false)
    expect(new Set(out.map((t) => t.id)).size).toBe(30)
  })
  it('max 3 per artist', () => {
    const out = forgottenFavs(mine, [], 30, seeded(2))
    const c = new Map<string, number>(); for (const t of out) c.set(t.artist, (c.get(t.artist) ?? 0) + 1)
    expect(Math.max(...c.values())).toBeLessThanOrEqual(3)
  })
  it('different seeds → different mixes (regenerate works)', () => {
    expect(forgottenFavs(mine, [], 20, seeded(3)).map((t) => t.id).join()).not.toBe(forgottenFavs(mine, [], 20, seeded(4)).map((t) => t.id).join())
  })
  it('falls back to older half when everything was played recently', () => {
    expect(forgottenFavs(mine.slice(0, 10), mine.slice(0, 10).map((t) => t.id), 5, seeded(5)).length).toBe(5)
  })
})
