import { create } from 'zustand'
import type { ArtistRef, ArtistSubscription } from '../../shared/types'

export type ArtistService = 'vk' | 'sc'
type AccountList = {
  account: number
  artists: ArtistSubscription[] | null
  status: 'loading' | 'ready' | 'failed'
  updatedAt: number
}

type Subscriptions = {
  vk: AccountList | null
  sc: AccountList | null
  load(source: ArtistService, account: number, force?: boolean): Promise<ArtistSubscription[] | null>
  confirmFollow(source: ArtistService, account: number, artist: ArtistSubscription, followed: boolean): void
}

const pending: Partial<Record<ArtistService, { account: number; request: Promise<ArtistSubscription[] | null> }>> = {}
const CACHE_MS = 60_000

export function sameSubscription(a: ArtistRef & { link?: string }, b: ArtistRef & { link?: string }): boolean {
  if (a.id && b.id) return a.id === b.id
  if (!a.link || !b.link) return false
  try {
    const path = (value: string) => new URL(value).pathname.replace(/\/$/, '')
    return path(a.link) === path(b.link)
  } catch { return false }
}

// Список живёт только в памяти и принадлежит конкретному аккаунту.
export const useArtistSubscriptions = create<Subscriptions>((set, get) => ({
  vk: null,
  sc: null,
  confirmFollow(source, account, artist, followed) {
    const current = get()[source]
    if (current?.account !== account || !current.artists) return
    const previous = current.artists.find((item) => sameSubscription(item, artist))
    const artists = followed ? (previous ? current.artists : [artist, ...current.artists])
      : current.artists.filter((item) => !sameSubscription(item, artist))
    if (pending[source]?.account === account) delete pending[source]
    set({ [source]: { ...current, artists, status: 'ready', updatedAt: 0 } })
  },
  load(source, account, force) {
    const running = pending[source]
    if (running?.account === account && !force) return running.request
    const current = get()[source]
    const previous = current?.account === account ? current : null
    if (!force && previous?.status === 'ready' && Date.now() - previous.updatedAt < CACHE_MS) return Promise.resolve(previous.artists)
    set({ [source]: { account, artists: previous?.artists ?? null, status: 'loading', updatedAt: 0 } })
    const request = window.api.invoke('artists:subscriptions', source).then((artists) => {
      if (pending[source]?.request === request) set({ [source]: { account, artists, status: 'ready', updatedAt: Date.now() } })
      return artists
    }).catch((error: unknown) => {
      if (pending[source]?.request === request) set({ [source]: { account, artists: previous?.artists ?? null, status: 'failed', updatedAt: 0 } })
      throw error
    }).finally(() => {
      if (pending[source]?.request === request) delete pending[source]
    })
    pending[source] = { account, request }
    return request
  }
}))
