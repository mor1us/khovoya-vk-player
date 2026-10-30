import { create } from 'zustand'
import type { Track, Playlist } from '../../shared/types'

type Lib = {
  mine: Track[]
  mineLoaded: boolean
  playlists: Playlist[]
  error: string | null
  loadMine(force?: boolean): Promise<Track[]>
  loadPlaylists(force?: boolean): Promise<Playlist[]>
  isMine(id: string): boolean
  setMine(t: Track[]): void
  setPlaylists(p: Playlist[]): void
}

export const useLibrary = create<Lib>((set, get) => ({
  mine: [], mineLoaded: false, playlists: [], error: null,
  async loadMine(force) {
    if (get().mineLoaded && !force) return get().mine
    try { const mine = await window.api.invoke<Track[]>('vk:myTracks'); set({ mine, mineLoaded: true, error: null }); return mine }
    catch (e) { set({ error: (e as Error).message }); return get().mine }
  },
  async loadPlaylists(force) {
    if (get().playlists.length && !force) return get().playlists
    try { const p = await window.api.invoke<Playlist[]>('vk:playlists'); set({ playlists: p }); return p }
    catch (e) { set({ error: (e as Error).message }); return get().playlists }
  },
  isMine(id) { return get().mine.some((t) => t.id === id) },
  setMine(mine) { set({ mine }) },
  setPlaylists(playlists) { set({ playlists }) }
}))
