import { create } from 'zustand'
import type { Track } from '../../shared/types'
import { topArtists, isFresh, type MyArtist } from './artistsLogic'
import { useLibrary } from './library'

export type ArtistCard = MyArtist & { tracks: Track[]; fresh: boolean }

export const useArtists = create<{ list: ArtistCard[] | null; loading: boolean; load(force?: boolean): Promise<void> }>((set, get) => ({
  list: null, loading: false,
  async load(force) {
    if ((get().list && !force) || get().loading) return
    set({ loading: true })
    try {
      const mine = await useLibrary.getState().loadMine()
      const own = new Set(mine.map((t) => t.id))
      const top = topArtists(mine, 9)
      const out: ArtistCard[] = top.map((a) => ({ ...a, tracks: [], fresh: false }))
      set({ list: out })
      let i = 0
      const worker = async () => {
        while (i < top.length) {
          const k = i++
          try {
            const tracks = await window.api.invoke<Track[]>('vk:artistTracks', { id: top[k].id, name: top[k].name })
            const fresh = tracks.some((t) => !own.has(t.id) && isFresh(t.addedAt, Date.now()))
            out[k] = { ...out[k], tracks, fresh, cover: out[k].cover ?? tracks[0]?.coverUrl }
            set({ list: [...out].sort((a, b) => Number(b.fresh) - Number(a.fresh) || b.count - a.count) })
          } catch { /* артист без треков — оставляем как есть */ }
        }
      }
      await Promise.all([worker(), worker(), worker()])
    } finally { set({ loading: false }) }
  }
}))
