import { describe, it, expect } from 'vitest'
import { applyReaction, emptyProfile, seedsFor, undoDislike, DAY } from '../src/renderer/wave/profile'
import { pickBatch, blend } from '../src/renderer/wave/picker'
import type { Track } from '../src/shared/types'

const tr = (i: number, artist = 'A' + (i % 10)): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist, duration: 100, url: 'u', available: true })
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 } }
const NOW = 1_000_000_000_000

describe('applyReaction', () => {
  it('weights per reaction', () => {
    let p = emptyProfile()
    p = applyReaction(p, tr(1, 'X'), 'like', NOW)
    expect(p.artists['x']).toBe(3); expect(p.seeds[0]).toBe('t1')
    p = applyReaction(p, tr(2, 'X'), 'finished', NOW); expect(p.artists['x']).toBe(4)
    p = applyReaction(p, tr(3, 'X'), 'earlySkip', NOW); expect(p.artists['x']).toBe(3); expect(p.snoozed['t3']).toBe(NOW + 7 * DAY)
    p = applyReaction(p, tr(4, 'X'), 'dislike', NOW); expect(p.artists['x']).toBe(-2); expect(p.banned).toContain('t4')
    expect(p.reactions).toBe(4)
  })
  it('does not mutate input and keeps seeds unique and capped', () => {
    const p0 = emptyProfile()
    let p = p0
    for (let i = 0; i < 40; i++) p = applyReaction(p, tr(i % 30), 'like', NOW)
    expect(p0.reactions).toBe(0)
    expect(new Set(p.seeds).size).toBe(p.seeds.length)
    expect(p.seeds.length).toBeLessThanOrEqual(30)
  })
  it('seedsFor gives 3–5 most recent seeds', () => {
    let p = emptyProfile()
    for (let i = 0; i < 8; i++) p = applyReaction(p, tr(i), 'like', NOW)
    const s = seedsFor(p, seeded(1))
    expect(s.length).toBeGreaterThanOrEqual(3); expect(s.length).toBeLessThanOrEqual(5)
    expect(s[0]).toBe('t7')
  })
})

describe('pickBatch', () => {
  const mineList = Array.from({ length: 40 }, (_, i) => tr(i))
  const mine = new Set(mineList.map((t) => t.id))
  const fresh = Array.from({ length: 60 }, (_, i) => tr(100 + i, 'N' + (i % 20)))
  const candidates = [...fresh, ...mineList]
  const base = { candidates, mine, profile: emptyProfile(), recent: [], now: NOW }

  it('filters banned, snoozed, recent and artists below −6', () => {
    let p = emptyProfile()
    p = applyReaction(p, tr(100, 'N0'), 'dislike', NOW)
    p = applyReaction(p, tr(101, 'N1'), 'earlySkip', NOW)
    p = { ...p, artists: { ...p.artists, n2: -7 } }
    const out = pickBatch({ ...base, profile: p, recent: ['t103'], mode: 'mix', rnd: seeded(2) })
    const ids = out.map((t) => t.id)
    expect(ids).not.toContain('t100'); expect(ids).not.toContain('t101'); expect(ids).not.toContain('t103')
    expect(out.some((t) => t.artist === 'N2')).toBe(false)
  })
  it('snooze expires after a week', () => {
    const p = applyReaction(emptyProfile(), tr(101, 'N1'), 'earlySkip', NOW)
    const later = pickBatch({ ...base, candidates: [tr(101, 'N1')], profile: p, mode: 'new', now: NOW + 8 * DAY, rnd: seeded(1) })
    expect(later.map((t) => t.id)).toContain('t101')
  })
  it('max 2 tracks per artist', () => {
    const out = pickBatch({ ...base, mode: 'mix', rnd: seeded(3) })
    const c = new Map<string, number>(); for (const t of out) c.set(t.artist, (c.get(t.artist) ?? 0) + 1)
    expect(Math.max(...c.values())).toBeLessThanOrEqual(2)
    expect(out.length).toBe(20)
  })
  it('mix gives 13–15 new of 20', () => {
    const out = pickBatch({ ...base, mode: 'mix', rnd: seeded(4) })
    const n = out.filter((t) => !mine.has(t.id)).length
    expect(n).toBeGreaterThanOrEqual(13); expect(n).toBeLessThanOrEqual(15)
  })
  it('new → none from mine; fav → only mine', () => {
    expect(pickBatch({ ...base, mode: 'new', rnd: seeded(5) }).some((t) => mine.has(t.id))).toBe(false)
    expect(pickBatch({ ...base, mode: 'fav', rnd: seeded(5) }).every((t) => mine.has(t.id))).toBe(true)
  })
  it('fills from mine when recommendations are short', () => {
    const out = pickBatch({ ...base, candidates: [...fresh.slice(0, 3), ...mineList], mode: 'mix', rnd: seeded(6) })
    expect(out.length).toBe(20)
  })
  it('prefers liked artists', () => {
    let p = emptyProfile()
    for (let i = 0; i < 4; i++) p = applyReaction(p, tr(900 + i, 'N5'), 'like', NOW)
    let hits = 0
    for (let k = 0; k < 50; k++) if (pickBatch({ ...base, profile: p, mode: 'new', rnd: seeded(k + 10), size: 5 }).some((t) => t.artist === 'N5')) hits++
    expect(hits).toBeGreaterThan(45)
  })
  it('skips unavailable tracks and duplicates', () => {
    const bad = { ...tr(500, 'Z'), available: false }
    const out = pickBatch({ ...base, candidates: [bad, ...candidates, ...candidates], mode: 'mix', rnd: seeded(8) })
    expect(out.some((t) => t.id === 't500')).toBe(false)
    expect(new Set(out.map((t) => t.id)).size).toBe(out.length)
  })
})

import { reactionFor } from '../src/renderer/wave/profile'
describe('reactionFor', () => {
  const t = { ...tr(1), duration: 200 }
  it('manual skip before 30 s → earlySkip', () => { expect(reactionFor(t, { listened: 12, manual: true })).toBe('earlySkip') })
  it('auto switch → finished', () => { expect(reactionFor(t, { listened: 194, manual: false })).toBe('finished') })
  it('manual near the end → finished', () => { expect(reactionFor(t, { listened: 190, manual: true })).toBe('finished') })
  it('manual in the middle → midSkip', () => { expect(reactionFor(t, { listened: 90, manual: true })).toBe('midSkip') })
})

describe('«Не нравится» можно вернуть', () => {
  const tr = { id: '1_1', ownerId: 1, vkId: 1, title: 'T', artist: 'Band', duration: 100, url: 'x', available: true }
  it('дизлайк кладёт трек в список, возврат убирает бан и вес', () => {
    const p = applyReaction(emptyProfile(), tr, 'dislike', 0)
    expect(p.banned).toEqual(['1_1'])
    expect(p.disliked?.map((t) => t.id)).toEqual(['1_1'])
    expect(p.disliked?.[0].url).toBe('')
    const q = undoDislike(p, tr)
    expect(q.banned).toEqual([])
    expect(q.disliked).toEqual([])
    expect(q.artists['band']).toBe(0)
  })
})

describe('blend', () => {
  const a = Array.from({ length: 10 }, (_, i) => 'v' + i)
  const b = Array.from({ length: 10 }, (_, i) => 'c' + i)

  it('ничего не теряет и не переставляет внутри списка', () => {
    const out = blend(a, b, seeded(7))
    expect(out).toHaveLength(20)
    expect(out.filter((x) => x.startsWith('v'))).toEqual(a)
    expect(out.filter((x) => x.startsWith('c'))).toEqual(b)
  })

  it('не выстраивает вечное «через один»', () => {
    const pairs = (out: string[]) => out.filter((x, i) => i > 0 && x[0] === out[i - 1][0]).length
    const runs = [1, 2, 3, 4, 5].map((s) => pairs(blend(a, b, seeded(s))))
    expect(runs.some((n) => n > 0)).toBe(true)
  })

  it('пустая сторона не мешает: отдаём второй список как есть', () => {
    expect(blend(a, [], seeded(3))).toEqual(a)
    expect(blend([], b, seeded(3))).toEqual(b)
    expect(blend([], [], seeded(3))).toEqual([])
  })
})
