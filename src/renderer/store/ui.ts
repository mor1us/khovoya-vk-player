import { cleanQuery } from '../ui/searchTags'
import { create } from 'zustand'
import type { Playlist, Session } from '../../shared/types'

export type ToastAction = { label: string; run: () => void }
export type Tab = 'home' | 'mine' | 'playlists' | 'downloads' | 'search' | 'settings' | 'playlist' | 'history' | 'similar' | 'queue' | 'disliked' | 'soundcloud'

type Ui = {
  tab: Tab
  history: Tab[]
  playlist: Playlist | null
  query: string
  /** Где искать: везде, только ВК или только SoundCloud. */
  searchWhere: 'all' | 'vk' | 'sc'
  setSearchWhere(w: 'all' | 'vk' | 'sc'): void
  submitted: string
  background: boolean
  session: Session | null
  toasts: { id: number; text: string; action?: ToastAction }[]
  go(t: Tab): void
  back(): void
  openPlaylist(p: Playlist): void
  setQuery(q: string): void
  submit(q?: string): void
  /** Подсказка внизу справа; action — кнопка (например, «Открыть»). */
  toast(text: string, action?: ToastAction): void
  setSession(s: Session | null): void
}

let tid = 0
export const useUi = create<Ui>((set, get) => ({
  tab: 'home', history: [], searchWhere: ((localStorage.getItem('searchWhere') as 'all' | 'vk' | 'sc') || 'all'),
  setSearchWhere(w) { localStorage.setItem('searchWhere', w); set({ searchWhere: w }) }, playlist: null, query: '', submitted: '', background: false, session: null, toasts: [],
  go(t) { if (t !== get().tab) set({ history: [...get().history.slice(-20), get().tab], tab: t }) },
  back() { const h = get().history; if (h.length) set({ tab: h[h.length - 1], history: h.slice(0, -1) }) },
  openPlaylist(p) { set({ playlist: p }); get().go('playlist') },
  setQuery(q) { set({ query: q }) },
  submit(q) {
    const s = cleanQuery(q ?? get().query)
    if (!s) return
    const hist = JSON.parse(localStorage.getItem('searchHistory') ?? '[]') as string[]
    localStorage.setItem('searchHistory', JSON.stringify([s, ...hist.filter((x) => x !== s)].slice(0, 10)))
    set({ submitted: s, query: s }); get().go('search')
  },
  toast(text, action) {
    const id = ++tid
    set({ toasts: [...get().toasts, { id, text, action }].slice(-3) })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), action ? 6000 : 4000)
  },
  setSession(s) { set({ session: s }) }
}))
