import { create } from 'zustand'
import type { Track } from '../../shared/types'

/** «Моё · SoundCloud»: треки SoundCloud, которые ты лайкнул в Хвое (хранятся на компе). */
type Sc = {
  likes: Track[]
  loaded: boolean
  load(): Promise<Track[]>
  isLiked(id: string): boolean
  /** true — теперь лайкнут, false — лайк снят. */
  toggle(t: Track): Promise<boolean>
  setLikes(t: Track[]): void
}

const strip = (t: Track): Track => ({ ...t, url: '' }) // ссылки на поток живут недолго — не храним

export const useSc = create<Sc>((set, get) => ({
  likes: [], loaded: false,
  async load() {
    if (get().loaded) return get().likes
    try { const likes = ((await window.api.invoke<Track[]>('scl:get')) ?? []).filter((t) => t?.src === 'sc'); set({ likes, loaded: true }) } catch { set({ loaded: true }) }
    return get().likes
  },
  isLiked(id) { return get().likes.some((t) => t.id === id) },
  async toggle(t) {
    await get().load()
    const on = !get().isLiked(t.id)
    get().setLikes(on ? [strip(t), ...get().likes] : get().likes.filter((x) => x.id !== t.id))
    return on
  },
  setLikes(likes) { set({ likes }); void window.api.invoke('scl:set', likes).catch(() => {}) }
}))
