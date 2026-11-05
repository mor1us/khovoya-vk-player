import type { LocalPl, Playlist, Track } from '../../shared/types'

/** Плейлисты Хвои: на компе, без ограничений ВК — можно смешивать треки ВК и SoundCloud. */
export type { LocalPl }

let list: LocalPl[] = []
let loaded = false

const strip = (t: Track): Track => (t.src === 'sc' ? { ...t, url: '' } : t)
const save = () => window.api.invoke('lpl:set', list).catch(() => {})

export async function loadLocal(): Promise<LocalPl[]> {
  if (loaded) return list
  try { list = ((await window.api.invoke('lpl:get')) ?? []).filter((x) => x && typeof x.id === 'number') } catch { list = [] }
  loaded = true
  return list
}

export function asPlaylist(l: LocalPl): Playlist {
  const covers = [...new Set(l.tracks.map((t) => t.coverUrl).filter(Boolean) as string[])].slice(0, 4)
  return { id: l.id, ownerId: 0, title: l.title, count: l.tracks.length, coverUrls: covers, isMine: true, updatedAt: l.updatedAt, local: true }
}

export const localPlaylists = (): Playlist[] => list.map(asPlaylist)
export const localTracks = (id: number): Track[] => list.find((x) => x.id === id)?.tracks ?? []

/** id — отрицательные, чтобы не пересекаться с плейлистами ВК. */
export function localCreate(title: string, tracks: Track[] = []): Playlist {
  const l: LocalPl = { id: -Date.now(), title, tracks: tracks.map(strip), updatedAt: Math.floor(Date.now() / 1000) }
  list = [l, ...list]; void save()
  return asPlaylist(l)
}

export function localSetTracks(id: number, tracks: Track[]): Playlist | null {
  const l = list.find((x) => x.id === id)
  if (!l) return null
  l.tracks = tracks.map(strip); l.updatedAt = Math.floor(Date.now() / 1000); void save()
  return asPlaylist(l)
}

export function localRename(id: number, title: string) { const l = list.find((x) => x.id === id); if (l) { l.title = title; void save() } }
export function localDelete(id: number) { list = list.filter((x) => x.id !== id); void save() }
