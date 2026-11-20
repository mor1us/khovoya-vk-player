import { describe, expect, it, vi } from 'vitest'
import type { ArtistTrackLookup } from '../src/shared/types'
import { ArtistTrackCatalog } from '../src/main/metadata/artistTracks'
import { matchRecording, matchReleaseDate, recordingQuery } from '../src/main/metadata/artistTracksLogic'
import { releaseDateOf } from '../src/shared/trackMetadata'

const track: ArtistTrackLookup = { id: '1_1', artist: 'Hxlkart', title: 'Storm', duration: 100 }
const mbid = '13dd61c7-ce73-4e97-9f0c-9f0e53144411'
const recording = { id: mbid, title: 'Storm', length: 100_000, 'artist-credit': [{ name: 'Hxlkart' }], 'first-release-date': '2024-04-11' }

describe('метаданные записи', () => {
  it('сохраняет точность даты и не подставляет день или месяц', () => {
    expect(releaseDateOf('2024-04-11T12:00:00Z')).toBe('2024-04-11')
    expect(releaseDateOf('2024-04')).toBe('2024-04')
    expect(releaseDateOf('2024-02-30')).toBeUndefined()
  })

  it('различает версии и отклоняет одноимённые записи с неоднозначным совпадением', () => {
    expect(matchRecording(track, [recording])).toEqual({ id: mbid, releaseDate: '2024-04-11' })
    expect(matchRecording(track, [{ ...recording, title: 'Storm (Live)' }])).toBeUndefined()
    expect(matchRecording(track, [recording, { ...recording, id: '13dd61c7-ce73-4e97-9f0c-9f0e53144412' }])).toBeUndefined()
    expect(matchRecording(track, [{ ...recording, length: 118_000 }])).toBeUndefined()
  })

  it('выбирает точный ISRC для поиска и не снимает кавычки с названия', () => {
    expect(recordingQuery([{ ...track, isrc: 'US-ABC-24-00001' }])).toBe('isrc:USABC2400001')
    expect(recordingQuery([{ ...track, title: 'Storm "live"' }])).toContain('recording:"Storm \\"live\\""')
  })

  it('принимает дату совпавшего трека и исключает переиздание', () => {
    const song = { artistName: 'Hxlkart', trackName: 'Storm', trackTimeMillis: 100_200 }
    expect(matchReleaseDate(track, [
      { ...song, releaseDate: '2024-04-11' },
      { ...song, releaseDate: '2020-04-11', collectionName: 'Bonus (Anniversary Edition)' },
      { ...song, releaseDate: '2015-04-11', trackName: 'Storm (Remix)' }
    ])).toBe('2024-04-11')
  })

  it('возвращает дату и счётчики по записи и повторно использует результат', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes('musicbrainz.org')) return Response.json({ recordings: [recording] })
      if (url.includes('listenbrainz.org')) return Response.json([{ recording_mbid: mbid, total_user_count: 4, total_listen_count: 13 }])
      return Response.json({ results: [] })
    })
    const catalog = new ArtistTrackCatalog(fetch, () => {})
    const metadata = { '1_1': { releaseDate: '2024-04-11', releaseSource: 'musicbrainz', listeners: 4, listens: 13 } }
    expect(await catalog.lookup('Hxlkart', [track])).toEqual(metadata)
    expect(await catalog.lookup('Hxlkart', [track])).toEqual(metadata)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
