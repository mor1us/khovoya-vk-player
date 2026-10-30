import { describe, it, expect } from 'vitest'
import { fmtTime, waveBars, hashStr, fmtTotal, plural } from '../src/renderer/ui/format'

describe('ui format', () => {
  it('fmtTime', () => {
    expect(fmtTime(0)).toBe('00:00'); expect(fmtTime(84)).toBe('01:24'); expect(fmtTime(3725)).toBe('1:02:05')
    expect(fmtTime(NaN)).toBe('00:00'); expect(fmtTime(-3)).toBe('00:00')
  })
  it('waveBars is deterministic, in range, n long', () => {
    const a = waveBars('1_2', 70), b = waveBars('1_2', 70)
    expect(a).toEqual(b); expect(a.length).toBe(70)
    expect(a.every((h) => h >= 0.15 && h <= 1)).toBe(true)
    expect(waveBars('1_3', 70)).not.toEqual(a)
  })
  it('hashStr stable and non-negative', () => { expect(hashStr('x')).toBe(hashStr('x')); expect(hashStr('abc')).toBeGreaterThanOrEqual(0) })
  it('fmtTotal', () => { expect(fmtTotal(15120)).toBe('4 ч 12 мин'); expect(fmtTotal(300)).toBe('5 мин') })
  it('plural (ru)', () => {
    const f = (n: number) => plural(n, 'трек', 'трека', 'треков')
    expect(f(1)).toBe('трек'); expect(f(3)).toBe('трека'); expect(f(5)).toBe('треков'); expect(f(11)).toBe('треков'); expect(f(21)).toBe('трек'); expect(f(112)).toBe('треков')
  })
})
