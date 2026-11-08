import { cleanQuery } from '../ui/searchTags'
import { readJson, writeJson } from './json'
import { pushSpot, stepBack, stepForward, type Spot } from './navLogic'
import { create } from 'zustand'
import type { ArtistRef, Playlist, Session } from '../../shared/types'

export type ToastAction = { label: string; run: () => void }
export type Tab = 'home' | 'mine' | 'playlists' | 'downloads' | 'search' | 'settings' | 'playlist' | 'artist' | 'history' | 'similar' | 'queue' | 'disliked' | 'soundcloud'

type Ui = {
  tab: Tab
  /** Где был и куда можно вернуться «вперёд» — как кнопки браузера и боковые кнопки мыши. */
  history: Spot[]
  ahead: Spot[]
  playlist: Playlist | null
  /** Кого показывает экран исполнителя. */
  artist: (ArtistRef & { cover?: string; src?: 'vk' | 'sc' }) | null
  query: string
  /** Где искать: везде, только ВК или только SoundCloud. */
  searchWhere: 'all' | 'vk' | 'sc'
  setSearchWhere(w: 'all' | 'vk' | 'sc'): void
  submitted: string
  background: boolean
  session: Session | null
  toasts: { id: number; text: string; action?: ToastAction }[]
  move(to: Spot): void
  go(t: Tab): void
  back(): void
  forward(): void
  openPlaylist(p: Playlist): void
  openArtist(a: ArtistRef & { cover?: string; src?: 'vk' | 'sc' }): void
  setQuery(q: string): void
  submit(q?: string): void
  /** Подсказка внизу справа; action — кнопка (например, «Открыть»). */
  toast(text: string, action?: ToastAction): void
  setSession(s: Session | null): void
}

/** Снимок того, где человек сейчас. */
const here = (s: { tab: Tab; playlist: Playlist | null; artist: Spot['artist']; submitted: string }): Spot => ({ tab: s.tab, playlist: s.playlist, artist: s.artist, submitted: s.submitted })

let tid = 0
export const useUi = create<Ui>((set, get) => ({
  tab: 'home', history: [], ahead: [], searchWhere: ((localStorage.getItem('searchWhere') as 'all' | 'vk' | 'sc') || 'all'),
  setSearchWhere(w) { localStorage.setItem('searchWhere', w); set({ searchWhere: w }) }, playlist: null, artist: null, query: '', submitted: '', background: false, session: null, toasts: [],
  go(t) { get().move({ ...here(get()), tab: t }) },
  /** Перейти в место целиком: вкладка вместе с тем, что на ней показано. */
  move(to) {
    const g = get()
    const step = pushSpot(g.history, here(g), to)
    if (!step) return
    set({ ...step, tab: to.tab as Tab, playlist: to.playlist, artist: to.artist, submitted: to.submitted })
  },
  back() { const g = get(); const r = stepBack(g.history, g.ahead, here(g)); if (r) set({ history: r.history, ahead: r.ahead, tab: r.spot.tab as Tab, playlist: r.spot.playlist, artist: r.spot.artist, submitted: r.spot.submitted }) },
  forward() { const g = get(); const r = stepForward(g.history, g.ahead, here(g)); if (r) set({ history: r.history, ahead: r.ahead, tab: r.spot.tab as Tab, playlist: r.spot.playlist, artist: r.spot.artist, submitted: r.spot.submitted }) },
  openPlaylist(p) { get().move({ ...here(get()), tab: 'playlist', playlist: p }) },
  openArtist(a) { get().move({ ...here(get()), tab: 'artist', artist: a }) },
  setQuery(q) { set({ query: q }) },
  submit(q) {
    const s = cleanQuery(q ?? get().query)
    if (!s) return
    const hist = readJson<string[]>('searchHistory', [])
    writeJson('searchHistory', [s, ...hist.filter((x) => x !== s)].slice(0, 10))
    set({ query: s })
    get().move({ ...here(get()), tab: 'search', submitted: s })
  },
  toast(text, action) {
    const id = ++tid
    set({ toasts: [...get().toasts, { id, text, action }].slice(-3) })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), action ? 6000 : 4000)
  },
  setSession(s) { set({ session: s }) }
}))
