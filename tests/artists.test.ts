import { describe, it, expect } from 'vitest'
import { matchVkArtists, topArtists, isFresh, artistTrackDetails, artistWhy, sortArtistTracks, FRESH_DAYS } from '../src/renderer/store/artistsLogic'
import type { Track } from '../src/shared/types'

const tr = (i: number, artist: string, extra: Partial<Track> = {}): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist, duration: 100, url: 'u', available: true, coverUrl: 'c' + i, ...extra })

describe('сортировка треков артиста', () => {
  it('сортирует в обе стороны, отличает ноль от отсутствующих данных и сохраняет исходную выдачу', () => {
    const tracks = [tr(1, 'A', { addedAt: 100 }), tr(2, 'A', { plays: 0, releaseDate: '2024-01-03' }), tr(3, 'A', { plays: 18, releaseDate: '2021-12-10' })]
    const ids = (order: Parameters<typeof sortArtistTracks>[1]) => sortArtistTracks(tracks, order).map((t) => t.id)
    expect(ids('mostPlayed')).toEqual(['t3', 't2', 't1'])
    expect(ids('leastPlayed')).toEqual(['t2', 't3', 't1'])
    expect(ids('new')).toEqual(['t2', 't3', 't1'])
    expect(ids('old')).toEqual(['t3', 't2', 't1'])
    expect(tracks.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('использует порядок «Популярное» ВК для треков с известным местом', () => {
    const tracks = [tr(1, 'A'), tr(2, 'A'), tr(3, 'A')]
    expect(sortArtistTracks(tracks, 'leastPlayed', ['t2', 't3']).map((t) => t.id)).toEqual(['t3', 't2', 't1'])
  })

  it('принимает уточнённую дату записи и использует сопоставимые счётчики слушателей', () => {
    const tracks = [tr(1, 'A', { addedAt: 100, plays: 9999 }), tr(2, 'A', { releaseDate: '2020-06-14' }), tr(3, 'A')]
    const metadata = { t2: { listeners: 3 }, t3: { releaseDate: '1990-07', listeners: 0 } }
    expect(sortArtistTracks(tracks, 'old', undefined, metadata).map((t) => t.id)).toEqual(['t3', 't2', 't1'])
    expect(sortArtistTracks(tracks, 'leastPlayed', undefined, metadata).map((t) => t.id)).toEqual(['t3', 't2', 't1'])
  })

  it('подписывает разные источники релиза и прослушиваний, включая нулевой счётчик', () => {
    const tip = artistTrackDetails(tr(1, 'A'), { releaseDate: '2024-04-11', releaseSource: 'itunes', listens: 0 })
    expect(tip).toBe('Дата релиза · 11.04.2024\nУчтено прослушиваний · 0\nИсточник даты · iTunes\nИсточник прослушиваний · ListenBrainz')
    expect(artistTrackDetails(tr(2, 'A', { addedAt: 100 }))).toBe('Дата релиза · нет данных\nПрослушиваний · нет данных')
  })

  it('ставит счётчики SoundCloud выше внешней статистики и подписывает использованное число', () => {
    const tracks = [tr(1, 'A', { src: 'sc', plays: 999 }), tr(2, 'A', { src: 'sc', plays: 3 })]
    const metadata = { t1: { listeners: 1, listens: 2 }, t2: { listeners: 100, listens: 200 } }
    expect(sortArtistTracks(tracks, 'mostPlayed', undefined, metadata).map((t) => t.id)).toEqual(['t1', 't2'])
    expect(artistTrackDetails(tracks[0], metadata.t1)).toContain('Прослушиваний · 999\nИсточник прослушиваний · SoundCloud')
    expect(artistTrackDetails({ ...tracks[1], plays: undefined }, metadata.t2)).toContain('Учтено прослушиваний · 200\nИсточник прослушиваний · ListenBrainz')
  })

  it('подписывает позицию ВК и отделяет дату загрузки SoundCloud от даты релиза', () => {
    expect(artistTrackDetails(tr(1, 'A'), undefined, 2)).toContain('Место в «Популярном» ВК · 2')
    const upload = tr(2, 'A', { src: 'sc', addedAt: Date.UTC(2024, 3, 11) / 1000 })
    expect(artistTrackDetails(upload)).toContain('Загружен в SoundCloud · 11.04.2024')
    expect(artistTrackDetails(upload)).toContain('Дата релиза · нет данных')
    expect(artistTrackDetails(upload, { releaseDate: '2024-04-11' })).not.toContain('Загружен в SoundCloud')
  })
})

describe('topArtists', () => {
  it('ranks by number of tracks, keeps id and a cover from the newest track', () => {
    const mine = [
      tr(1, 'Дворы', { artists: [{ id: 'a1', name: 'Дворы' }] }), tr(2, 'Мира Лин'), tr(3, 'Дворы', { artists: [{ id: 'a1', name: 'Дворы' }] }),
      tr(4, 'дворы '), tr(5, 'Мира Лин'), tr(6, 'Один')
    ]
    const top = topArtists(mine, 2)
    expect(top.map((a) => a.name)).toEqual(['Дворы', 'Мира Лин'])
    expect(top[0]).toMatchObject({ id: 'a1', count: 3, cover: 'c1' })
  })
  it('splits "feat." and comma lists by main artist only', () => {
    const top = topArtists([tr(1, 'A feat. B'), tr(2, 'A, C'), tr(3, 'A & D')], 3)
    expect(top[0]).toMatchObject({ name: 'A', count: 3 })
  })
  it('skips unknown artist', () => { expect(topArtists([tr(1, 'Неизвестен')], 3)).toEqual([]) })
})

describe('поиск исполнителей ВК', () => {
  it('ищет по имени исполнителя и сохраняет ID одноимённых профилей', () => {
    const tracks = [
      tr(1, 'Подпись', { artists: [{ id: 'a1', name: 'Артист' }, { id: 'b1', name: 'Гость' }] }),
      tr(2, 'Артист', { artists: [{ id: 'a2', name: 'Артист' }] }),
      tr(3, 'Другой', { title: 'Артист' }),
      tr(4, 'Другой feat. Артист')
    ]
    expect(matchVkArtists(tracks, ' АРТИСТ ')).toEqual([
      { id: 'a1', name: 'Артист', cover: 'c1' },
      { id: 'a2', name: 'Артист', cover: 'c2' },
      { id: '', name: 'Артист', cover: 'c4' }
    ])
    expect(matchVkArtists(tracks, '  ')).toEqual([])
  })
})

describe('isFresh', () => {
  it(`within ${FRESH_DAYS} days`, () => {
    const now = 1_800_000_000_000
    expect(isFresh(now / 1000 - 3 * 86400, now)).toBe(true)
    expect(isFresh(now / 1000 - (FRESH_DAYS + 1) * 86400, now)).toBe(false)
    expect(isFresh(undefined, now)).toBe(false)
  })
})

describe('artistWhy', () => {
  const now = 1_800_000_000_000
  const fresh = now / 1000 - 2 * 86400
  const old = now / 1000 - 400 * 86400
  const own = new Set(['t1'])

  it('подписывает только то, о чём стоит сказать', () => {
    expect(artistWhy({ ...tr(1, 'A'), addedAt: old }, own, now)).toBe('в твоей музыке')
    expect(artistWhy({ ...tr(2, 'A'), addedAt: fresh }, own, now)).toBe('новое')
    expect(artistWhy({ ...tr(3, 'A'), addedAt: old }, own, now)).toBe('')
  })

  it('своё остаётся своим, даже если вышло на днях', () => {
    expect(artistWhy({ ...tr(1, 'A'), addedAt: fresh }, own, now)).toBe('в твоей музыке')
  })
})
