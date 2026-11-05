import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { applyTune, artistLangMap, freshness, isRussian, matchLangs, matchMood, modeFor, normalizeTune, tuneBoost, tuneQueries, tuneSummary, EMPTY_TUNE } from '../src/renderer/wave/tune'

const tr = (id: string, title: string, artist: string, addedAt?: number): Track =>
  ({ id, ownerId: 1, vkId: 1, title, artist, duration: 180, url: 'u', available: true, addedAt })
const T = (over: Partial<typeof EMPTY_TUNE>) => ({ ...EMPTY_TUNE, ...over })

describe('язык Волны', () => {
  it('русский / иностранный / без слов', () => {
    expect(matchLangs(tr('1', 'Кукла колдуна', 'Король и Шут'), ['ru'])).toBe(true)
    expect(matchLangs(tr('2', 'Numb', 'Linkin Park'), ['ru'])).toBe(false)
    expect(matchLangs(tr('2', 'Numb', 'Linkin Park'), ['foreign'])).toBe(true)
    expect(matchLangs(tr('3', 'Night (Instrumental)', 'X'), ['none'])).toBe(true)
    expect(matchLangs(tr('3', 'Night (Instrumental)', 'X'), ['foreign'])).toBe(false) // просили со словами
  })
  it('несколько языков — любой из них', () => {
    expect(matchLangs(tr('1', 'Песня', 'Группа'), ['ru', 'foreign'])).toBe(true)
    expect(matchLangs(tr('2', 'Song', 'Band'), ['ru', 'foreign'])).toBe(true)
  })
  it('«Русский» + «Без слов» — инструменталы русских исполнителей', () => {
    expect(matchLangs(tr('1', 'Ночь (инструментал)', 'Скриптонит'), ['ru', 'none'])).toBe(true)
    expect(matchLangs(tr('2', 'Night (Instrumental)', 'Hans Zimmer'), ['ru', 'none'])).toBe(false)
    expect(matchLangs(tr('3', 'Ночь', 'Скриптонит'), ['ru', 'none'])).toBe(false) // со словами — не то
    expect(matchLangs(tr('2', 'Night (Instrumental)', 'Hans Zimmer'), ['foreign', 'none'])).toBe(true)
  })
  it('русский исполнитель с латиницей в имени узнаётся по другим его трекам', () => {
    const known = [tr('a', 'Детство', 'Kai Angel'), tr('b', 'Ангелы', 'Kai Angel'), tr('c', 'Lights', 'Kai Angel')]
    const map = artistLangMap(known)
    const t = tr('x', 'Heaven', 'Kai Angel')
    expect(isRussian(t)).toBe(false)
    expect(isRussian(t, map)).toBe(true)
    expect(matchLangs(t, ['ru'], map)).toBe(true)
  })
})

describe('настроение, узнаваемость, свежесть', () => {
  it('настроение по словам в названии', () => {
    expect(matchMood(tr('1', 'Sad Girl', 'A'), 'sad')).toBe(true)
    expect(matchMood(tr('1', 'Грустная песня', 'A'), 'sad')).toBe(true)
    expect(matchMood(tr('1', 'Party Rock', 'A'), 'sad')).toBe(false)
  })
  it('узнаваемость задаёт режим, можно несколько', () => {
    expect(modeFor(EMPTY_TUNE)).toBe('mix')
    expect(modeFor(T({ recog: ['known'] }))).toBe('fav')
    expect(modeFor(T({ recog: ['unknown'] }))).toBe('new')
    expect(modeFor(T({ recog: ['new'] }))).toBe('mix')
    expect(modeFor(T({ recog: ['unknown', 'new'] }))).toBe('new')
    expect(modeFor(T({ recog: ['known', 'new'] }))).toBe('fav')
    expect(modeFor(T({ recog: ['known', 'unknown'] }))).toBe('mix')
  })
  it('свежее выше, очень старое ниже', () => {
    const now = Date.UTC(2026, 9, 31)
    const d = (days: number) => tr('x', 'a', 'b', now / 1000 - days * 86400)
    expect(freshness(d(10), now)).toBe(3)
    expect(freshness(d(200), now)).toBe(2)
    expect(freshness(d(3000), now)).toBe(-1)
    expect(freshness(tr('x', 'a', 'b'), now)).toBe(0)
  })
  it('очки: подборки ВК и свежесть важнее поиска, с «Новинками» свежесть вдвойне', () => {
    const now = Date.UTC(2026, 9, 31)
    const fresh = tr('f', 'a', 'b', now / 1000 - 10 * 86400), old = tr('o', 'a', 'b', now / 1000 - 3000 * 86400)
    const source = new Map([['f', 1], ['o', 4]])
    const opts = { now, moodHits: new Set<string>(), source }
    expect(tuneBoost(fresh, T({ recog: ['new'] }), opts)).toBeGreaterThan(tuneBoost(old, T({ recog: ['new'] }), opts))
    expect(tuneBoost(old, T({ recog: ['known'] }), opts)).toBe(4) // «Знакомое» — свежесть не важна
  })
})

describe('отбор и поиски', () => {
  it('язык фильтрует строго, если подходящих хватает', () => {
    const c = [...Array.from({ length: 10 }, (_, i) => tr('r' + i, 'Песня ' + i, 'Артист')), tr('e', 'Song', 'Band')]
    expect(applyTune(c, T({ lang: ['ru'] }), 0, 20).some((t) => t.id === 'e')).toBe(false)
  })
  it('«Новинки» оставляют только свежее за год, если его хватает', () => {
    const now = Date.UTC(2026, 9, 31)
    const c = [tr('f', 'a', 'b', now / 1000 - 30 * 86400), tr('o', 'c', 'd', now / 1000 - 2000 * 86400)]
    expect(applyTune(c, T({ recog: ['unknown', 'new'] }), now, 1).map((t) => t.id)).toEqual(['f'])
  })
  it('если подходящих по языку почти нет — ничего не теряем', () => {
    const c = [tr('r', 'Песня', 'Артист'), tr('e1', 'Song', 'Band'), tr('e2', 'Song 2', 'Band')]
    expect(applyTune(c, T({ lang: ['ru'] }), 0, 20)).toHaveLength(3)
  })
  it('нет общих запросов вроде «русские хиты» — свежее берём у любимых артистов', () => {
    const q = tuneQueries(T({ lang: ['ru'] }), ['скриптонит', 'markul'])
    expect(q.map((x) => x.q)).toEqual(['скриптонит', 'markul'])
    expect(q.every((x) => x.byDate)).toBe(true)
  })
  it('настроение + язык + без слов', () => {
    expect(tuneQueries(T({ mood: ['sad'], lang: ['ru'] }), []).map((x) => x.q)).toEqual(['грустные песни'])
    expect(tuneQueries(T({ mood: ['sad'], lang: ['ru', 'none'] }), []).map((x) => x.q)).toEqual(['sad piano instrumental', 'грустные песни без слов'])
    expect(tuneQueries(EMPTY_TUNE, ['a'])).toEqual([])
  })
  it('подпись и чтение старого формата', () => {
    expect(tuneSummary(T({ mood: ['sad'], lang: ['ru', 'none'] }))).toBe('Грустно · Русский · Без слов')
    expect(normalizeTune({ mood: 'sad', lang: 'ru' })).toEqual({ mood: ['sad'], recog: [], lang: ['ru'] })
    expect(normalizeTune({ mood: ['bad', 'joy'] })).toEqual({ mood: ['joy'], recog: [], lang: [] })
    expect(normalizeTune(null)).toEqual(EMPTY_TUNE)
  })
})
