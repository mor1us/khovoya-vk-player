import { describe, it, expect } from 'vitest'
import { bump, trim, fromHistory, topPlayed, statOf, whenText, timesText, statSummary, type Stats } from '../src/renderer/store/statsLogic'
import type { Track } from '../src/shared/types'

const tr = (id: string, over: Partial<Track> = {}): Track => ({ id, ownerId: 1, vkId: 1, title: 'Т', artist: 'А', duration: 100, url: '', available: true, ...over })
const NOW = new Date('2026-11-13T10:00:00').getTime()

describe('счётчики', () => {
  it('копит прослушивания, помнит первый и последний раз', () => {
    let s: Stats = {}
    s = bump(s, 'a', 1000, { plays: 1 })
    s = bump(s, 'a', 5000, { plays: 1 })
    expect(statOf(s, 'a')).toMatchObject({ plays: 2, firstAt: 1000, lastAt: 5000 })
  })

  it('Волна считается отдельно и не трогает «последний раз слушал»', () => {
    let s = bump({}, 'a', 1000, { plays: 1 })
    s = bump(s, 'a', 9000, { wave: 1 })
    expect(statOf(s, 'a')).toMatchObject({ plays: 1, wave: 1, lastAt: 1000 })
  })

  it('незнакомый трек — честные нули, а не пусто', () => {
    expect(statOf({}, 'нет')).toEqual({ plays: 0, firstAt: 0, lastAt: 0, wave: 0, done: 0, skip: 0 })
  })

  it('старую запись не меняем на месте — иначе окно не перерисуется', () => {
    const s: Stats = {}
    const next = bump(s, 'a', 1, { plays: 1 })
    expect(s).toEqual({})
    expect(next).not.toBe(s)
  })
})

describe('trim', () => {
  it('расстаётся с теми, кого слушали давно и мало', () => {
    const s: Stats = {
      люб: { plays: 50, firstAt: 1, lastAt: 10, wave: 0, done: 0, skip: 0 },
      свеж: { plays: 1, firstAt: 1, lastAt: 9999, wave: 0, done: 0, skip: 0 },
      забыт: { plays: 1, firstAt: 1, lastAt: 5, wave: 0, done: 0, skip: 0 }
    }
    expect(Object.keys(trim(s, 2)).sort()).toEqual(['люб', 'свеж'])
    expect(trim(s, 10)).toBe(s) // влезает — не трогаем
  })
})

describe('fromHistory', () => {
  it('переносит уже накопленное: история идёт от новых к старым', () => {
    const h = [
      { track: tr('a'), at: 300 },
      { track: tr('b'), at: 200 },
      { track: tr('a'), at: 100 }
    ]
    const s = fromHistory(h)
    expect(statOf(s, 'a')).toMatchObject({ plays: 2, firstAt: 100, lastAt: 300 })
    expect(statOf(s, 'b').plays).toBe(1)
  })
})

describe('topPlayed', () => {
  it('самое заслушанное сверху, неслушанное не берём', () => {
    let s = bump({}, 'a', 1, { plays: 1 })
    s = bump(s, 'b', 2, { plays: 1 }); s = bump(s, 'b', 3, { plays: 1 })
    s = bump(s, 'c', 4, { wave: 1 })
    expect(topPlayed(s, 5).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('слова для человека', () => {
  it('раз, раза, раз', () => {
    expect(timesText(1)).toBe('1 раз')
    expect(timesText(3)).toBe('3 раза')
    expect(timesText(7)).toBe('7 раз')
    expect(timesText(11)).toBe('11 раз')
    expect(timesText(22)).toBe('22 раза')
  })

  it('сегодня, вчера, дата', () => {
    expect(whenText(new Date('2026-11-13T02:08:00').getTime(), NOW)).toBe('сегодня в 02:08')
    expect(whenText(new Date('2026-11-12T23:40:00').getTime(), NOW)).toBe('вчера в 23:40')
    expect(whenText(new Date('2026-03-03T12:00:00').getTime(), NOW)).toBe('3 марта')
    expect(whenText(new Date('2025-03-03T12:00:00').getTime(), NOW)).toBe('3 марта 2025')
    expect(whenText(0, NOW)).toBe('никогда')
  })

  it('сводка под курсором говорит главное', () => {
    let s = bump({}, 'a', new Date('2026-11-13T02:08:00').getTime(), { plays: 1 })
    s = bump(s, 'a', 1, { wave: 2 })
    const text = statSummary(statOf(s, 'a'), tr('a'), NOW)
    expect(text).toContain('Слушал 1 раз, последний раз сегодня в 02:08')
    expect(text).toContain('В Волне попадался 2 раза')
    expect(statSummary(statOf({}, 'нет'), tr('x'), NOW)).toContain('Ещё ни разу не слушал')
  })
})
