import { describe, it, expect } from 'vitest'
import { matchVkArtists, topArtists, isFresh, artistTrackDetails, artistWhy, collectArtistTracks, sortArtistTracks, FRESH_DAYS } from '../src/renderer/store/artistsLogic'
import type { Track } from '../src/shared/types'

const tr = (i: number, artist: string, extra: Partial<Track> = {}): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist, duration: 100, url: 'u', available: true, coverUrl: 'c' + i, ...extra })

describe('сортировка треков артиста', () => {
  it('сортирует в обе стороны, отличает ноль от отсутствующих данных и сохраняет исходную выдачу', () => {
    const tracks = [tr(1, 'A', { src: 'sc' }), tr(2, 'A', { src: 'sc', plays: 0, addedAt: 300 }), tr(3, 'A', { src: 'sc', plays: 18, addedAt: 100 })]
    const ids = (order: Parameters<typeof sortArtistTracks>[1]) => sortArtistTracks(tracks, order).map((t) => t.id)
    expect(ids('mostPlayed')).toEqual(['t3', 't2', 't1'])
    expect(ids('leastPlayed')).toEqual(['t2', 't3', 't1'])
    expect(ids('new')).toEqual(['t2', 't3', 't1'])
    expect(ids('old')).toEqual(['t3', 't2', 't1'])
    expect(tracks.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('сохраняет порядок ВК по умолчанию и сортирует по датам только по выбору', () => {
    const uploaded = tr(1, 'A', { addedAt: Date.UTC(2024, 3, 11) / 1000, plays: 300 })
    const released = tr(2, 'A', { releaseDate: '2025-01-03', addedAt: 100 })
    const tracks = [uploaded, released]
    expect(sortArtistTracks(tracks, 'catalog')).toBe(tracks)
    expect(sortArtistTracks(tracks, 'new').map((t) => t.id)).toEqual(['t2', 't1'])
    expect(sortArtistTracks(tracks, 'old').map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('в SoundCloud сортирует по дате загрузки и ставит треки без неё в конец', () => {
    const tracks = [
      tr(1, 'A', { src: 'sc', releaseDate: '2025-01-01' }),
      tr(2, 'A', { src: 'sc', addedAt: 100, releaseDate: '2024-01-01' }),
      tr(3, 'A', { src: 'sc', addedAt: 300 }),
      tr(4, 'A', { src: 'sc', addedAt: 200 })
    ]
    const metadata = { t3: { releaseDate: '2020-01-01' } }
    expect(sortArtistTracks(tracks, 'new', metadata).map((t) => t.id)).toEqual(['t3', 't4', 't2', 't1'])
    expect(sortArtistTracks(tracks, 'old', metadata).map((t) => t.id)).toEqual(['t2', 't4', 't3', 't1'])
  })

  it('принимает уточнённую дату записи и использует сопоставимые счётчики слушателей', () => {
    const tracks = [tr(1, 'A', { plays: 9999 }), tr(2, 'A', { releaseDate: '2020-06-14' }), tr(3, 'A')]
    const metadata = { t2: { listeners: 3 }, t3: { releaseDate: '1990-07', listeners: 0 } }
    expect(sortArtistTracks(tracks, 'old', metadata).map((t) => t.id)).toEqual(['t3', 't2', 't1'])
    const scTracks = tracks.map(({ plays: _plays, ...track }) => ({ ...track, src: 'sc' as const }))
    expect(sortArtistTracks(scTracks, 'leastPlayed', metadata).map((t) => t.id)).toEqual(['t3', 't2', 't1'])
  })

  it('показывает у ВК только дату, даже если у трека сохранились счётчики', () => {
    const tip = artistTrackDetails(tr(1, 'A', { plays: 0 }), { releaseDate: '2024-04-11', releaseSource: 'itunes', listens: 23 })
    expect(tip).toBe('Релиз · 11.04.2024 · iTunes')
    expect(artistTrackDetails(tr(2, 'A'))).toBe('Сведений о треке пока нет')
    const uploaded = tr(1, 'A', { addedAt: Date.UTC(2024, 3, 11) / 1000, plays: 300 })
    expect(artistTrackDetails(uploaded)).toBe('Загружен · 11.04.2024')
  })

  it('ставит счётчики SoundCloud выше внешней статистики и подписывает использованное число', () => {
    const tracks = [tr(1, 'A', { src: 'sc', plays: 999 }), tr(2, 'A', { src: 'sc', plays: 3 })]
    const metadata = { t1: { listeners: 1, listens: 2 }, t2: { listeners: 100, listens: 200 } }
    expect(sortArtistTracks(tracks, 'mostPlayed', metadata).map((t) => t.id)).toEqual(['t1', 't2'])
    expect(artistTrackDetails(tracks[0], metadata.t1)).toBe('Прослушиваний · 999')
    expect(artistTrackDetails({ ...tracks[1], plays: undefined }, metadata.t2)).toBe('ListenBrainz · 200')
  })

  it('оставляет в SoundCloud только число прослушиваний и дату загрузки', () => {
    const upload = tr(2, 'A', { src: 'sc', plays: 32_028, releaseDate: '2020-02-01', addedAt: Date.UTC(2026, 8, 20) / 1000 })
    expect(artistTrackDetails(upload, { releaseDate: '2024-04-11' })).toBe('Прослушиваний · 32\u00a0028\nЗагружен · 20.09.2026')
    expect(artistTrackDetails({ ...upload, plays: undefined })).toBe('Загружен · 20.09.2026')
  })
})

describe('автоматическая загрузка треков артиста', () => {
  it('публикует первую страницу сразу, проходит пустую и убирает дубли', async () => {
    const published: { ids: string[]; more: boolean }[] = []
    await collectArtistTracks<string>(async (cursor) => {
      if (!cursor) return { tracks: [tr(1, 'A')], next: '2' }
      expect(published[0]).toEqual({ ids: ['t1'], more: true })
      return cursor === '2' ? { tracks: [], next: '3' } : { tracks: [tr(1, 'A'), tr(2, 'A')] }
    }, () => true, (tracks, _added, more) => published.push({ ids: tracks.map((t) => t.id), more }))
    expect(published).toEqual([{ ids: ['t1'], more: true }, { ids: ['t1', 't2'], more: false }])
  })

  it('останавливается на повторе курсора и оставляет загруженные треки', async () => {
    let ids: string[] = []
    await expect(collectArtistTracks<string>(async () => ({ tracks: [tr(1, 'A')], next: 'same' }),
      () => true, (tracks) => { ids = tracks.map((t) => t.id) })).rejects.toThrow(/повторил страницу/)
    expect(ids).toEqual(['t1'])
  })

  it('не публикует страницу после ухода с артиста', async () => {
    let active = true
    let calls = 0
    await collectArtistTracks<string>(async (cursor) => {
      calls++
      if (cursor) active = false
      return { tracks: [tr(calls, 'A')], next: String(calls) }
    }, () => active, (tracks) => expect(tracks.map((t) => t.id)).toEqual(['t1']))
    expect(calls).toBe(2)
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
