import { describe, it, expect } from 'vitest'
import { Queue } from '../src/renderer/player/queue'
import type { Track } from '../src/shared/types'

const tr = (i: number, available = true): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist: 'A' + i, duration: 100, url: available ? 'u' : '', available })
const five = () => [0, 1, 2, 3, 4].map((i) => tr(i))

describe('Queue', () => {
  it('next/prev move through the list', () => {
    const q = new Queue(five(), 0, 'mine')
    expect(q.current()?.id).toBe('t0')
    expect(q.next(true)?.id).toBe('t1')
    expect(q.prev()?.id).toBe('t0')
    expect(q.peekNext()?.id).toBe('t1')
  })
  it('repeat off: stops after last', () => {
    const q = new Queue(five(), 4, 'mine')
    expect(q.next(true)).toBeNull()
  })
  it('repeat all: wraps to first', () => {
    const q = new Queue(five(), 4, 'mine'); q.repeat = 'all'
    expect(q.next(true)?.id).toBe('t0')
  })
  it("repeat one: auto next returns same, manual next moves on", () => {
    const q = new Queue(five(), 2, 'mine'); q.repeat = 'one'
    expect(q.next(true)?.id).toBe('t2')
    expect(q.next(false)?.id).toBe('t3')
  })
  it('shuffle off restores original order with same current', () => {
    const q = new Queue(five(), 2, 'mine')
    q.setShuffle(true, [])
    expect(q.current()?.id).toBe('t2')
    expect(q.list()[0].id).toBe('t2')
    q.next(true)
    const cur = q.current()!.id
    q.setShuffle(false, [])
    expect(q.list().map((t) => t.id)).toEqual(['t0', 't1', 't2', 't3', 't4'])
    expect(q.current()?.id).toBe(cur)
  })
  it('skips unavailable tracks', () => {
    const q = new Queue([tr(0), tr(1, false), tr(2)], 0, 'x')
    expect(q.next(true)?.id).toBe('t2')
    expect(q.prev()?.id).toBe('t0')
  })
  it('all unavailable → null', () => {
    const q = new Queue([tr(0), tr(1, false), tr(2, false)], 0, 'x'); q.repeat = 'all'
    expect(q.next(true)?.id).toBe('t0')
    const q2 = new Queue([tr(1, false), tr(2, false)], 0, 'x'); q2.repeat = 'all'
    expect(q2.next(true)).toBeNull()
  })
  it('start index on unavailable moves to first available', () => {
    const q = new Queue([tr(0, false), tr(1)], 0, 'x')
    expect(q.current()?.id).toBe('t1')
  })
  it('jumpTo and append', () => {
    const q = new Queue(five(), 0, 'x')
    q.jumpTo('t3'); expect(q.current()?.id).toBe('t3')
    q.append([tr(9)]); expect(q.list().at(-1)?.id).toBe('t9')
    expect(q.remaining()).toBe(2)
  })
  it('round-trips through JSON', () => {
    const q = new Queue(five(), 3, 'pl:5'); q.repeat = 'all'; q.setShuffle(true, [])
    const r = Queue.fromJSON(JSON.parse(JSON.stringify(q.toJSON())))
    expect(r.current()?.id).toBe(q.current()?.id)
    expect(r.list().map((t) => t.id)).toEqual(q.list().map((t) => t.id))
    expect(r.repeat).toBe('all'); expect(r.shuffled).toBe(true); expect(r.source).toBe('pl:5')
  })
})
