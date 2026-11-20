import type { ArtistTrackLookup } from '../../shared/types'
import { normalizeIsrc, releaseDateOf } from '../../shared/trackMetadata'

type Recording = {
  id?: string
  title?: string
  length?: number | null
  isrcs?: string[]
  'artist-credit'?: { name?: string; artist?: { name?: string }; joinphrase?: string }[]
  'first-release-date'?: string
}
type Song = { artistName?: string; trackName?: string; trackTimeMillis?: number; releaseDate?: string; collectionName?: string }

const fold = (value: string | undefined) => (value ?? '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
  .replace(/\s+(?:feat\.?|ft\.?|x|&|and)\s+|,/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const quote = (value: string) => '"' + value.replace(/[\\"]/g, '\\$&') + '"'

export function recordingQuery(tracks: ArtistTrackLookup[]): string {
  return tracks.map((track) => {
    const isrc = normalizeIsrc(track.isrc)
    return isrc ? `isrc:${isrc}` : `(recording:${quote(track.title)} AND artist:${quote(track.artist)})`
  }).join(' OR ')
}

function matches(track: ArtistTrackLookup, title: string | undefined, artist: string | undefined, milliseconds: number | null | undefined) {
  if (fold(title) !== fold(track.title) || fold(artist) !== fold(track.artist)) return false
  return !track.duration || typeof milliseconds !== 'number' || Math.abs(track.duration * 1000 - milliseconds) <= 4000
}

export function matchRecording(track: ArtistTrackLookup, candidates: Recording[]): { id: string; releaseDate?: string } | undefined {
  const isrc = normalizeIsrc(track.isrc)
  const identified = isrc ? candidates.filter((r) => r.isrcs?.some((candidate) => normalizeIsrc(candidate) === isrc)) : []
  const named = (identified.length ? identified : candidates).filter((r) => {
    const credit = (r['artist-credit'] ?? []).map((a) => (a.name || a.artist?.name || '') + (a.joinphrase ?? ' ')).join('')
    return matches(track, r.title, credit, r.length)
  })
  const unique = [...new Map(named.filter((r) => typeof r.id === 'string' && /^[0-9a-f-]{36}$/i.test(r.id)).map((r) => [r.id, r])).values()]
  const [recording] = unique
  if (unique.length !== 1 || !recording.id) return
  return { id: recording.id, releaseDate: releaseDateOf(recording['first-release-date']) }
}

export function matchReleaseDate(track: ArtistTrackLookup, songs: Song[]): string | undefined {
  const dates = songs.filter((song) => matches(track, song.trackName, song.artistName, song.trackTimeMillis))
    .filter((song) => !/\b(?:remaster\w*|deluxe|anniversary|reissue)\b/i.test(song.collectionName ?? ''))
    .map((song) => releaseDateOf(song.releaseDate)).filter((date): date is string => !!date)
  return dates.sort()[0]
}
