import { describe, it, expect } from 'vitest'
import { pushHistory, groupByDay, HISTORY_MAX } from '../src/renderer/store/historyLogic'
import type { Track } from '../src/shared/types'

const tr = (i: number): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist: 'A', duration: 100, url: 'https://u', available: true })
const D = (s: string) => new Date(s).getTime()

describe('pushHistory', () => {
  it('adds newest first and strips the stream url', () => {
    const h = pushHistory(pushHistory([], tr(1), 1000), tr(2), 2000)
    expect(h.map((e) => e.track.id)).toEqual(['t2', 't1'])
    expect(h[0].track.url).toBe('')
    expect(h[0].at).toBe(2000)
  })
  it('same track twice in a row → only time updated', () => {
    const h = pushHistory(pushHistory([], tr(1), 1000), tr(1), 5000)
    expect(h.length).toBe(1); expect(h[0].at).toBe(5000)
  })
  it('caps length', () => {
    let h: ReturnType<typeof pushHistory> = []
    for (let i = 0; i < HISTORY_MAX + 20; i++) h = pushHistory(h, tr(i), i)
    expect(h.length).toBe(HISTORY_MAX)
  })
})

describe('groupByDay', () => {
  it('Сегодня / Вчера / date', () => {
    const now = D('2026-10-31T02:40:00')
    const h = [
      { track: tr(1), at: D('2026-10-31T02:30:00') },
      { track: tr(2), at: D('2026-10-30T23:00:00') },
      { track: tr(3), at: D('2026-10-27T12:00:00') }
    ]
    const g = groupByDay(h, now)
    expect(g.map((x) => x.label)).toEqual(['Сегодня', 'Вчера', '27 октября'])
    expect(g[0].items[0].track.id).toBe('t1')
  })
})
