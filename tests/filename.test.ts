import { describe, it, expect } from 'vitest'
import { safeFileName, uniqueName } from '../src/main/downloads/filename'

describe('safeFileName', () => {
  it('basic', () => { expect(safeFileName('Дворы', 'Кислота')).toBe('Дворы - Кислота.mp3') })
  it('replaces forbidden chars', () => { expect(safeFileName('A/B', 'x:y*?"<>|\\')).toBe('A_B - x_y_______.mp3') })
  it('reserved names', () => {
    expect(safeFileName('CON', 'NUL')).toBe('_CON - NUL.mp3')
    expect(safeFileName('aux', '')).toBe('_aux - Без названия.mp3')
  })
  it('trims trailing dots and spaces and control chars', () => {
    expect(safeFileName('Art. ', 'Song...  ')).toBe('Art - Song.mp3')
    expect(safeFileName('a\u0000b', 't\tq')).toBe('a_b - t_q.mp3')
  })
  it('limits length to 150 chars before .mp3', () => {
    const n = safeFileName('А'.repeat(200), 'Б'.repeat(200))
    expect(n.length).toBeLessThanOrEqual(154); expect(n.endsWith('.mp3')).toBe(true)
  })
})

describe('uniqueName', () => {
  it('adds (2), (3)', () => {
    const taken = new Set(['a - b.mp3', 'a - b (2).mp3'])
    expect(uniqueName('a - b.mp3', (n) => taken.has(n))).toBe('a - b (3).mp3')
    expect(uniqueName('x.mp3', () => false)).toBe('x.mp3')
  })
})
