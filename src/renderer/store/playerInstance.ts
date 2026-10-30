import { useStore } from 'zustand'
import type { Track } from '../../shared/types'
import { PlayerEngine } from '../player/engine'
import { createPlayer, type PlayerState } from './player'

/** Подписчики на события плеера (Волна, Discord, уведомления) подключаются позже — без циклических импортов. */
export const playerHooks = {
  trackChange: [] as ((prev: Track | null, next: Track | null, info: { listened: number; manual: boolean }) => void)[],
  queueLow: [] as ((remaining: number) => void)[],
  notice: [] as ((msg: string) => void)[],
  crossfadeSec: 6
}

const fullId = (t: Track) => (t.accessKey ? `${t.id}_${t.accessKey}` : t.id)

export const engine = new PlayerEngine()
export const player = createPlayer({
  engine,
  storage: localStorage,
  crossfadeSec: () => playerHooks.crossfadeSec,
  async resolveUrl(t) {
    try { const local = await window.api.invoke<string | null>('dl:localPath', t.id); if (local) return local } catch { /* нет загрузок */ }
    return t.url
  },
  async refreshUrl(t) {
    const [fresh] = await window.api.invoke<Track[]>('vk:byId', [fullId(t)])
    return fresh?.available ? fresh.url : ''
  },
  onNotice: (m) => playerHooks.notice.forEach((f) => f(m)),
  onTrackChange: (p, n, i) => playerHooks.trackChange.forEach((f) => f(p, n, i)),
  onQueueLow: (r) => playerHooks.queueLow.forEach((f) => f(r))
})

export function usePlayer<T>(sel: (s: PlayerState) => T): T { return useStore(player, sel) }
