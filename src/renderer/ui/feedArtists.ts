import type { Track } from '../../shared/types'

/** Подписки SoundCloud: артисты из ленты (новое сверху), у каждого — его свежие треки. */
export function feedArtists(feed: Track[], max = 9): { name: string; cover?: string; id: string; artistId?: string; tracks: Track[] }[] {
  const by = new Map<string, { name: string; cover?: string; id: string; artistId?: string; tracks: Track[] }>()
  for (const t of feed) {
    const name = t.artistProfileName || t.artist
    const k = t.artistId ? 'id:' + t.artistId : 'name:' + name.toLowerCase()
    const a = by.get(k) ?? { name, cover: t.coverUrl, id: t.id, artistId: t.artistId, tracks: [] }
    a.tracks.push(t); by.set(k, a)
  }
  return [...by.values()].slice(0, max)
}
