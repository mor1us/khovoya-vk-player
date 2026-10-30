import { describe, it, expect } from 'vitest'
import { gains, fadePlan } from '../src/renderer/player/crossfade'

describe('gains (equal power)', () => {
  it('endpoints', () => {
    expect(gains(0)).toEqual({ out: 1, in: 0 })
    const e = gains(1); expect(e.out).toBeCloseTo(0, 6); expect(e.in).toBeCloseTo(1, 6)
  })
  it('out²+in²≈1 at 11 points', () => {
    for (let i = 0; i <= 10; i++) { const g = gains(i / 10); expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1, 6) }
  })
  it('clamps outside [0,1]', () => { expect(gains(-1)).toEqual({ out: 1, in: 0 }); expect(gains(2).in).toBeCloseTo(1) })
})

describe('fadePlan', () => {
  it('manual switch → 0.3 s', () => {
    expect(fadePlan({ duration: 200, crossfadeSec: 6, repeat: 'off', manual: true })).toMatchObject({ startAt: 0, length: 0.3 })
  })
  it('repeat one → no crossfade', () => {
    expect(fadePlan({ duration: 200, crossfadeSec: 6, repeat: 'one', manual: false }).startAt).toBeNull()
  })
  it('short track → no crossfade', () => {
    expect(fadePlan({ duration: 25, crossfadeSec: 6, repeat: 'off', manual: false }).startAt).toBeNull()
  })
  it('crossfade 0 → none', () => {
    expect(fadePlan({ duration: 200, crossfadeSec: 0, repeat: 'off', manual: false }).startAt).toBeNull()
  })
  it('normal → starts N s before end, preload 10 s earlier', () => {
    expect(fadePlan({ duration: 200, crossfadeSec: 6, repeat: 'all', manual: false })).toEqual({ startAt: 194, length: 6, preloadAt: 184 })
  })
  it('preloadAt without crossfade = duration-10', () => {
    expect(fadePlan({ duration: 200, crossfadeSec: 0, repeat: 'off', manual: false }).preloadAt).toBe(190)
  })
})
