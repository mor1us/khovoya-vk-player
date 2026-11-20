import { setTimeout as pause } from 'node:timers/promises'
import type { ArtistTrackLookup, ArtistTrackMetadata } from '../../shared/types'
import { releaseDateOf } from '../../shared/trackMetadata'
import { matchRecording, matchReleaseDate, recordingQuery } from './artistTracksLogic'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>
const CACHE_MS = 60 * 60_000
const MB_USER_AGENT = 'Khvoya/1.0 (https://github.com/mor1us/khovoya-vk-player)'

export class ArtistTrackCatalog {
  private cache = new Map<string, { at: number; data: ArtistTrackMetadata }>()
  private musicBrainzQueue: Promise<void> = Promise.resolve()
  private lastMusicBrainz = 0
  private nextMusicBrainz = 0
  constructor(private fetch: Fetch, private log: (message: string) => void) {}

  private async json(url: URL | string, init?: RequestInit) {
    const response = await this.fetch(String(url), { ...init, signal: AbortSignal.timeout(4500) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  private recordings(tracks: ArtistTrackLookup[]): Promise<Parameters<typeof matchRecording>[1]> {
    const request = this.musicBrainzQueue.then(async () => {
      if (Date.now() < this.nextMusicBrainz) return []
      await pause(Math.max(0, 1100 - (Date.now() - this.lastMusicBrainz)))
      this.lastMusicBrainz = Date.now()
      const url = new URL('https://musicbrainz.org/ws/2/recording/')
      url.search = new URLSearchParams({ query: recordingQuery(tracks), fmt: 'json', limit: '100' }).toString()
      try {
        const data = await this.json(url, { headers: { 'User-Agent': MB_USER_AGENT } })
        return Array.isArray(data?.recordings) ? data.recordings : []
      } catch {
        this.nextMusicBrainz = Date.now() + 60_000
        this.log('даты релизов: поиск записей не ответил')
        return []
      }
    })
    this.musicBrainzQueue = request.then(() => {}, () => {})
    return request
  }

  private async storefront(artist: string): Promise<Parameters<typeof matchReleaseDate>[1]> {
    const url = new URL('https://itunes.apple.com/search')
    url.search = new URLSearchParams({ term: artist, media: 'music', entity: 'song', attribute: 'artistTerm', limit: '200' }).toString()
    try {
      const data = await this.json(url)
      return Array.isArray(data?.results) ? data.results : []
    } catch {
      this.log('даты релизов: каталог релизов не ответил')
      return []
    }
  }

  private async popularity(ids: string[]): Promise<Map<string, Pick<ArtistTrackMetadata, 'listeners' | 'listens'>>> {
    const count = new Map<string, Pick<ArtistTrackMetadata, 'listeners' | 'listens'>>()
    if (!ids.length) return count
    try {
      const data = await this.json('https://api.listenbrainz.org/1/popularity/recording', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recording_mbids: ids })
      })
      if (Array.isArray(data)) for (const item of data) {
        if (typeof item?.recording_mbid !== 'string') continue
        const listeners = Number.isSafeInteger(item.total_user_count) && item.total_user_count >= 0 ? item.total_user_count : undefined
        const listens = Number.isSafeInteger(item.total_listen_count) && item.total_listen_count >= 0 ? item.total_listen_count : undefined
        count.set(item.recording_mbid, { listeners, listens })
      }
    } catch { this.log('популярность треков: счётчики не загрузились') }
    return count
  }

  async lookup(artist: string, tracks: ArtistTrackLookup[]): Promise<Record<string, ArtistTrackMetadata>> {
    const result: [string, ArtistTrackMetadata][] = []
    if (typeof artist !== 'string' || !artist.trim() || artist.length > 200 || !Array.isArray(tracks)) return {}
    const queue = tracks.slice(0, 40).filter((track) => track && typeof track.id === 'string' &&
      typeof track.title === 'string' && !!track.title.trim() && track.title.length <= 300 &&
      typeof track.artist === 'string' && !!track.artist.trim() && track.artist.length <= 200)
    const key = (track: ArtistTrackLookup) => JSON.stringify([track.artist, track.title, track.duration, track.isrc, track.releaseDate])
    const missing = queue.filter((track) => {
      const cached = this.cache.get(key(track))
      if (!cached || Date.now() - cached.at >= CACHE_MS) return true
      result.push([track.id, cached.data])
      return false
    })
    if (!missing.length) return Object.fromEntries(result)

    const recordingBatches = []
    for (let i = 0; i < missing.length; i += 10) recordingBatches.push(this.recordings(missing.slice(i, i + 10)))
    const [catalog, songs] = await Promise.all([Promise.all(recordingBatches), this.storefront(artist)])
    const recordings = catalog.flat()
    const matches = missing.map((track) => ({ track, recording: matchRecording(track, recordings) }))
    const popularity = await this.popularity([...new Set(matches.flatMap(({ recording }) => recording ? [recording.id] : []))])
    for (const { track, recording } of matches) {
      const knownDate = releaseDateOf(track.releaseDate)
      const storefrontDate = !recording?.releaseDate && !knownDate ? matchReleaseDate(track, songs) : undefined
      const data: ArtistTrackMetadata = {
        releaseDate: recording?.releaseDate ?? knownDate ?? storefrontDate,
        releaseSource: recording?.releaseDate ? 'musicbrainz' : storefrontDate ? 'itunes' : undefined,
        ...(recording && popularity.get(recording.id))
      }
      if (this.cache.size >= 1500) this.cache.delete(this.cache.keys().next().value!)
      this.cache.set(key(track), { at: Date.now(), data })
      result.push([track.id, data])
    }
    return Object.fromEntries(result)
  }
}
