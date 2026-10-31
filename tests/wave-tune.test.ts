import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { applyTune, matchLang, matchMood, modeFor, normalizeTune, tuneQueries, tuneSummary, EMPTY_TUNE } from '../src/renderer/wave/tune'

const tr = (id: string, title: string, artist: string, addedAt?: number): Track =>
  ({ id, ownerId: 1, vkId: 1, title, artist, duration: 180, url: 'u', available: true, addedAt })

describe('настройки Волны', () => {
  it('язык: русский, иностранный, без слов', () => {
    expect(matchLang(tr('1', 'Кукла колдуна', 'Король и Шут'), 'ru')).toBe(true)
    expect(matchLang(tr('2', 'Numb', 'Linkin Park'), 'ru')).toBe(false)
    expect(matchLang(tr('2', 'Numb', 'Linkin Park'), 'foreign')).toBe(true)
    expect(matchLang(tr('3', 'Night (Instrumental)', 'X'), 'none')).toBe(true)
    expect(matchLang(tr('3', 'Night (Instrumental)', 'X'), 'foreign')).toBe(false)
  })

  it('настроение по словам в названии', () => {
    expect(matchMood(tr('1', 'Sad Girl', 'A'), 'sad')).toBe(true)
    expect(matchMood(tr('1', 'Грустная песня', 'A'), 'sad')).toBe(true)
    expect(matchMood(tr('1', 'Party Rock', 'A'), 'sad')).toBe(false)
  })

  it('узнаваемость задаёт режим', () => {
    expect(modeFor(EMPTY_TUNE)).toBe('mix')
    expect(modeFor({ ...EMPTY_TUNE, recog: 'known' })).toBe('fav')
    expect(modeFor({ ...EMPTY_TUNE, recog: 'unknown' })).toBe('new')
    expect(modeFor({ ...EMPTY_TUNE, recog: 'new' })).toBe('new')
  })

  it('язык фильтрует жёстко, если подходящих хватает', () => {
    const c = [...Array.from({ length: 10 }, (_, i) => tr('r' + i, 'Песня ' + i, 'Артист')), tr('e', 'Song', 'Band')]
    const r = applyTune(c, { ...EMPTY_TUNE, lang: 'ru' }, new Set(), 0, 20)
    expect(r.some((t) => t.id === 'e')).toBe(false)
  })

  it('если подходящих по языку почти нет — ничего не теряем', () => {
    const c = [tr('r', 'Песня', 'Артист'), tr('e1', 'Song', 'Band'), tr('e2', 'Song 2', 'Band')]
    expect(applyTune(c, { ...EMPTY_TUNE, lang: 'ru' }, new Set(), 0, 20)).toHaveLength(3)
  })

  it('настроение: треки из поиска под настроение считаются подходящими', () => {
    const c = [tr('a', 'Track', 'X'), tr('b', 'Track 2', 'Y')]
    const r = applyTune(c, { ...EMPTY_TUNE, mood: 'sad' }, new Set(['a']), 0, 1)
    expect(r.map((t) => t.id)).toEqual(['a'])
  })

  it('новинки: свежие треки, если их хватает', () => {
    const now = Date.UTC(2026, 9, 31)
    const fresh = tr('f', 'New', 'A', now / 1000 - 86400 * 10)
    const old = tr('o', 'Old', 'B', now / 1000 - 86400 * 900)
    expect(applyTune([old, fresh], { ...EMPTY_TUNE, recog: 'new' }, new Set(), now, 1).map((t) => t.id)).toEqual(['f'])
  })

  it('поиски под настройки', () => {
    expect(tuneQueries({ mood: 'sad', recog: null, lang: 'ru' }, [])).toEqual([{ q: 'грустные песни', byDate: false }])
    expect(tuneQueries({ mood: 'sad', recog: null, lang: null }, []).map((x) => x.q)).toEqual(['грустные песни', 'sad songs'])
    expect(tuneQueries({ mood: null, recog: 'new', lang: null }, ['A', 'B']).every((x) => x.byDate)).toBe(true)
    expect(tuneQueries(EMPTY_TUNE, [])).toEqual([])
  })

  it('подпись и чтение из хранилища', () => {
    expect(tuneSummary({ mood: 'sad', recog: null, lang: 'ru' })).toBe('Грустно · Русский')
    expect(normalizeTune({ mood: 'bad', lang: 'ru' })).toEqual({ mood: null, recog: null, lang: 'ru' })
    expect(normalizeTune(null)).toEqual(EMPTY_TUNE)
  })
})
