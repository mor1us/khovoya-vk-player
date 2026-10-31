import { create } from 'zustand'
import type { Playlist, Track } from '../../shared/types'

export type ScMe = { id: number; name: string; avatar?: string }
type ScPlaylistRef = { id: number; title: string; count: number; cover?: string; link?: string; mine: boolean }

/**
 * SoundCloud в Хвое: лайки (на компе + из аккаунта, если вошёл), плейлисты и лента аккаунта.
 * Лайк сердечком сохраняется на компе всегда, а при входе — ещё и на SoundCloud.
 */
type Sc = {
  likes: Track[]          // лайки в Хвое (на компе)
  accLikes: Track[]       // лайки из аккаунта SoundCloud
  me: ScMe | null
  accPlaylists: Playlist[]
  feed: Track[] | null
  loaded: boolean
  accError: string
  load(): Promise<Track[]>
  loadAccount(force?: boolean): Promise<void>
  loadFeed(): Promise<void>
  login(): Promise<void>
  logout(): Promise<void>
  allLikes(): Track[]
  isLiked(id: string): boolean
  toggle(t: Track): Promise<boolean>
  setLikes(t: Track[]): void
}

const strip = (t: Track): Track => ({ ...t, url: '' }) // ссылки на поток живут недолго — не храним
const asPlaylist = (p: ScPlaylistRef): Playlist => ({ id: p.id, ownerId: 0, title: p.title, count: p.count, coverUrls: p.cover ? [p.cover] : [], isMine: false, updatedAt: 0, sc: true, subtitle: p.mine ? 'твой плейлист SoundCloud' : 'лайкнутый плейлист SoundCloud' })

export const useSc = create<Sc>((set, get) => ({
  likes: [], accLikes: [], me: null, accPlaylists: [], feed: null, loaded: false, accError: '',
  async load() {
    if (get().loaded) return get().allLikes()
    try { const likes = ((await window.api.invoke<Track[]>('scl:get')) ?? []).filter((t) => t?.src === 'sc'); set({ likes, loaded: true }) } catch { set({ loaded: true }) }
    void get().loadAccount()
    return get().allLikes()
  },
  async loadAccount(force) {
    try {
      const me = await window.api.invoke<ScMe | null>('scacc:me')
      set({ me, accError: '' })
      if (!me) { set({ accLikes: [], accPlaylists: [], feed: null }); return }
      if (!force && get().accLikes.length) return
      const [likes, pls] = await Promise.all([
        window.api.invoke<Track[]>('scacc:likes').catch((e) => { set({ accError: (e as Error).message }); return [] as Track[] }),
        window.api.invoke<ScPlaylistRef[]>('scacc:playlists').catch(() => [] as ScPlaylistRef[])
      ])
      set({ accLikes: likes, accPlaylists: pls.map(asPlaylist) })
    } catch (e) { set({ accError: (e as Error).message }) }
  },
  async loadFeed() {
    if (!get().me) return
    set({ feed: null })
    try { set({ feed: await window.api.invoke<Track[]>('scacc:feed') }) } catch (e) { set({ feed: [], accError: (e as Error).message }) }
  },
  async login() {
    const me = await window.api.invoke<ScMe | null>('scacc:login')
    set({ me })
    await get().loadAccount(true)
  },
  async logout() {
    await window.api.invoke('scacc:logout')
    set({ me: null, accLikes: [], accPlaylists: [], feed: null })
  },
  allLikes() {
    const acc = get().accLikes
    const ids = new Set(acc.map((t) => t.id))
    return [...get().likes.filter((t) => !ids.has(t.id)), ...acc]
  },
  isLiked(id) { return get().likes.some((t) => t.id === id) || get().accLikes.some((t) => t.id === id) },
  async toggle(t) {
    await get().load()
    const on = !get().isLiked(t.id)
    get().setLikes(on ? [strip(t), ...get().likes] : get().likes.filter((x) => x.id !== t.id))
    if (get().me) { // вошёл в аккаунт — лайк ставим и на SoundCloud
      set({ accLikes: on ? [strip(t), ...get().accLikes] : get().accLikes.filter((x) => x.id !== t.id) })
      await window.api.invoke('scacc:like', t, on).catch((e) => { throw new Error((on ? 'В Хвое лайк сохранён, а на SoundCloud — нет: ' : 'В Хвое лайк снят, а на SoundCloud — нет: ') + (e as Error).message) })
    }
    return on
  },
  setLikes(likes) { set({ likes }); void window.api.invoke('scl:set', likes).catch(() => {}) }
}))
