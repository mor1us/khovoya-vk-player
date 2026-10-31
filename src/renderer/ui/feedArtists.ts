import type { Track } from '../../shared/types'

/** Подписки SoundCloud: артисты из ленты (новое сверху), у каждого — его свежие треки. */
export function feedArtists(feed: Track[], max = 9): { name: string; cover?: string; id: string; tracks: Track[] }[] {
  const by = new Map<string, { name: string; cover?: string; id: string; tracks: Track[] }>()
  for (const t of feed) {
    const k = t.artist.toLowerCase()
    const a = by.get(k) ?? { name: t.artist, cover: t.coverUrl, id: t.id, tracks: [] }
    a.tracks.push(t); by.set(k, a)
  }
  return [...by.values()].slice(0, max)
}
