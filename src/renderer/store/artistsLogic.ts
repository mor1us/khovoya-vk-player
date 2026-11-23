import type { ArtistSubscription, ArtistTrackMetadata, ArtistTracksPage, Track } from '../../shared/types'

export const FRESH_DAYS = 14
export type ArtistTrackOrder = 'new' | 'old' | 'mostPlayed' | 'leastPlayed'

export function sortArtistTracks(tracks: Track[], order: ArtistTrackOrder, popularTrackIds?: string[], metadata: Record<string, ArtistTrackMetadata> = {}): Track[] {
  const byDate = order === 'new' || order === 'old'
  const direction = order === 'new' || order === 'mostPlayed' ? -1 : 1
  const counts = !byDate && tracks.some((t) => t.plays !== undefined)
  const hasExternal = !byDate && (!counts || !tracks.every((t) => t.src === 'sc'))
  const hasListeners = hasExternal && tracks.some((t) => metadata[t.id]?.listeners !== undefined)
  const hasListens = hasExternal && tracks.some((t) => metadata[t.id]?.listens !== undefined)
  const popularity = new Map(popularTrackIds?.map((id, index) => [id, -index]))
  const value = (track: Track) => {
    const data = metadata[track.id]
    if (!byDate) return hasListeners ? data?.listeners : counts ? track.plays : hasListens ? data?.listens : popularity.get(track.id)
    if (track.src === 'sc') return track.addedAt
    const date = data?.releaseDate ?? track.releaseDate
    return date ? Date.parse(date) / 1000 : track.addedAt
  }
  return [...tracks].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === undefined || right === undefined) return Number(left === undefined) - Number(right === undefined)
    return direction * (left - right)
  })
}

export function artistTrackDetails(track: Track, data?: ArtistTrackMetadata, vkRank?: number, vkReleasePlays?: number): string {
  const sc = track.src === 'sc'
  const lines: string[] = []
  if (track.plays !== undefined) lines.push('Прослушиваний · ' + track.plays.toLocaleString('ru-RU'))
  else if (!sc && vkReleasePlays !== undefined) lines.push('Прослушивания релиза · ' + vkReleasePlays.toLocaleString('ru-RU'))
  else if (data?.listens !== undefined) lines.push('ListenBrainz · ' + data.listens.toLocaleString('ru-RU'))
  else if (!sc && vkRank !== undefined) lines.push('Популярное ВК · №' + vkRank)

  const date = sc ? undefined : data?.releaseDate ?? track.releaseDate
  if (date) {
    const source = data?.releaseSource === 'musicbrainz' ? 'MusicBrainz' : data?.releaseSource === 'itunes' ? 'iTunes' : undefined
    lines.push('Релиз · ' + date.split('-').reverse().join('.') + (source ? ' · ' + source : ''))
  } else if (track.addedAt) {
    lines.push('Загружен · ' + new Date(track.addedAt * 1000).toLocaleDateString('ru-RU', { timeZone: 'UTC' }))
  }
  return lines.join('\n') || 'Сведений о треке пока нет'
}

export async function collectArtistTracks<Cursor>(
  fetchPage: (cursor?: Cursor) => Promise<ArtistTracksPage<Cursor>>,
  active: () => boolean,
  onPage: (tracks: Track[], added: Track[], hasMore: boolean) => void
): Promise<void> {
  const tracks = new Map<string, Track>()
  const cursors = new Set<string>()
  let cursor: Cursor | undefined
  do {
    const page = await fetchPage(cursor)
    if (!active()) return
    const added: Track[] = []
    for (const track of page.tracks) {
      if (tracks.has(track.id)) continue
      tracks.set(track.id, track)
      added.push(track)
    }
    cursor = page.next
    const hasMore = cursor !== undefined
    if (added.length || !hasMore) onPage([...tracks.values()], added, hasMore)
    if (!hasMore) return
    const key = JSON.stringify(cursor)
    if (cursors.has(key)) throw new Error('Сервис повторил страницу треков')
    cursors.add(key)
  } while (active())
}
export type MyArtist = { key: string; name: string; id?: string; count: number; cover?: string }

/** Главный исполнитель трека: из main_artists ВК или первое имя до «feat.», «,», «&». */
function mainArtist(t: Track): { id?: string; name: string } | null {
  if (t.artists?.length) return t.artists[0]
  const name = t.artist.split(/\s+(?:feat\.?|ft\.?|x|&)\s+|,/i)[0].trim()
  return name && name !== 'Неизвестен' ? { name } : null
}

/** Самые частые исполнители в твоей музыке. Список «Моё» идёт от новых к старым — обложку берём у самого свежего. */
export function topArtists(mine: Track[], n: number): MyArtist[] {
  const map = new Map<string, MyArtist>()
  for (const t of mine) {
    const a = mainArtist(t)
    if (!a) continue
    const key = a.name.trim().toLowerCase()
    const cur = map.get(key)
    if (cur) { cur.count++; if (!cur.id && a.id) cur.id = a.id; if (!cur.cover && t.coverUrl) cur.cover = t.coverUrl }
    else map.set(key, { key, name: a.name.trim(), id: a.id, count: 1, cover: t.coverUrl })
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, n)
}

export function matchVkArtists(tracks: Track[], query: string): ArtistSubscription[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const matches: ArtistSubscription[] = []
  for (const track of tracks) {
    const refs = track.artists?.length ? track.artists : track.artist.split(/\s+(?:feat\.?|ft\.?|x|&)\s+|,/i).map((name) => ({ name, id: '' }))
    for (const ref of refs) {
      const name = ref.name.trim()
      if (name.toLowerCase() !== 'неизвестен' && name.toLowerCase().includes(needle)) matches.push({ name, id: ref.id, cover: track.coverUrl })
    }
  }
  return matches
}

export function isFresh(dateSec: number | undefined, now: number): boolean {
  return !!dateSec && now / 1000 - dateSec <= FRESH_DAYS * 86400
}

/** Подпись трека на экране артиста: лишнего не говорим, молчание — тоже ответ. */
export function artistWhy(t: Track, own: Set<string>, now: number): string {
  if (own.has(t.id)) return 'в твоей музыке'
  return isFresh(t.addedAt, now) ? 'новое' : ''
}
