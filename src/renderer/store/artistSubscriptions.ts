import { create } from 'zustand'
import type { ArtistSubscription } from '../../shared/types'

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
}

const pending: Partial<Record<ArtistService, { account: number; request: Promise<ArtistSubscription[] | null> }>> = {}
const CACHE_MS = 60_000

// Список живёт только в памяти и принадлежит конкретному аккаунту.
export const useArtistSubscriptions = create<Subscriptions>((set, get) => ({
  vk: null,
  sc: null,
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
