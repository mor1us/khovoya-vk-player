import { create } from 'zustand'
import type { Playlist, Track } from '../../shared/types'
import { optimistic, planAdd, moveItem } from './playlistLogic'
import { useLibrary } from './library'
import { useUi } from './ui'

/** Треки открытых плейлистов (кэш по id). */
export const usePlTracks = create<{ byId: Record<number, Track[]>; loading: Record<number, boolean> }>(() => ({ byId: {}, loading: {} }))

export async function loadPlaylistTracks(p: Playlist, force = false): Promise<Track[]> {
  const s = usePlTracks.getState()
  if (s.byId[p.id] && !force) return s.byId[p.id]
  usePlTracks.setState({ loading: { ...s.loading, [p.id]: true } })
  try {
    const tracks = await window.api.invoke<Track[]>('vk:playlistTracks', p)
    usePlTracks.setState((x) => ({ byId: { ...x.byId, [p.id]: tracks } }))
    return tracks
  } finally { usePlTracks.setState((x) => ({ loading: { ...x.loading, [p.id]: false } })) }
}

const setTracks = (id: number, t: Track[]) => usePlTracks.setState((x) => ({ byId: { ...x.byId, [id]: t } }))
const bumpCount = (id: number, d: number) => useLibrary.getState().setPlaylists(useLibrary.getState().playlists.map((p) => (p.id === id ? { ...p, count: Math.max(0, p.count + d) } : p)))
const fail = (m: string) => useUi.getState().toast(m)

export async function addToPlaylist(p: Playlist, tracks: Track[]): Promise<{ duplicate: boolean }> {
  const current = usePlTracks.getState().byId[p.id] ?? (await loadPlaylistTracks(p).catch(() => []))
  const { toAdd, duplicate } = planAdd(current.map((t) => t.id), tracks.map((t) => t.id))
  if (duplicate) fail(toAdd.length ? 'Часть треков уже есть в плейлисте — добавляю остальные' : 'Уже есть в плейлисте')
  if (!toAdd.length) return { duplicate: true }
  const add = tracks.filter((t) => toAdd.includes(t.id))
  const ok = await optimistic(
    () => { setTracks(p.id, [...current, ...add]); bumpCount(p.id, add.length); return current },
    () => window.api.invoke('pl:addTracks', p, toAdd),
    (prev) => { setTracks(p.id, prev); bumpCount(p.id, -add.length) }
  )
  if (ok) useUi.getState().toast(`Добавлено в «${p.title}»`)
  else fail('ВК не дал добавить трек. Попробуй ещё раз.')
  return { duplicate }
}

export async function removeFromPlaylist(p: Playlist, tracks: Track[]) {
  const current = usePlTracks.getState().byId[p.id] ?? []
  const ids = new Set(tracks.map((t) => t.id))
  const ok = await optimistic(
    () => { setTracks(p.id, current.filter((t) => !ids.has(t.id))); bumpCount(p.id, -ids.size); return current },
    () => window.api.invoke('pl:removeTracks', p, [...ids]),
    (prev) => { setTracks(p.id, prev); bumpCount(p.id, ids.size) }
  )
  if (!ok) fail('Не получилось убрать трек из плейлиста')
}

export async function reorderInPlaylist(p: Playlist, id: string, to: number) {
  const current = usePlTracks.getState().byId[p.id] ?? []
  const mv = moveItem(current.map((t) => t.id), id, to)
  const map = new Map(current.map((t) => [t.id, t]))
  const track = map.get(id)
  if (!track) return
  const ok = await optimistic(
    () => { setTracks(p.id, mv.list.map((x) => map.get(x)!)); return current },
    () => window.api.invoke('pl:reorder', track, mv.before, mv.after, p),
    (prev) => setTracks(p.id, prev)
  )
  if (!ok) fail('ВК не дал поменять порядок')
}

export async function createPlaylistWith(title: string, tracks: Track[]): Promise<Playlist | null> {
  try {
    const p = await window.api.invoke<Playlist>('pl:create', title)
    useLibrary.getState().setPlaylists([p, ...useLibrary.getState().playlists])
    setTracks(p.id, [])
    if (tracks.length) await addToPlaylist(p, tracks)
    return p
  } catch (e) { fail((e as Error).message || 'Не удалось создать плейлист'); return null }
}

export async function renamePlaylist(p: Playlist, title: string) {
  const prev = useLibrary.getState().playlists
  const ok = await optimistic(
    () => { useLibrary.getState().setPlaylists(prev.map((x) => (x.id === p.id ? { ...x, title } : x))); return prev },
    () => window.api.invoke('pl:edit', p, title),
    (x) => useLibrary.getState().setPlaylists(x)
  )
  if (!ok) fail('Не удалось переименовать')
}

export async function deletePlaylist(p: Playlist) {
  const prev = useLibrary.getState().playlists
  const ok = await optimistic(
    () => { useLibrary.getState().setPlaylists(prev.filter((x) => x.id !== p.id)); return prev },
    () => window.api.invoke('pl:delete', p),
    (x) => useLibrary.getState().setPlaylists(x)
  )
  if (!ok) fail('Не удалось удалить плейлист')
}
