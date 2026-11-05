import { useStore } from 'zustand'
import type { Track } from '../../shared/types'
import { PlayerEngine } from '../player/engine'
import { createPlayer, type PlayerState } from './player'
import { bestMatch } from '../../shared/match'

/** Подписчики на события плеера (Волна, Discord, уведомления) подключаются позже — без циклических импортов. */
export const playerHooks = {
  trackChange: [] as ((prev: Track | null, next: Track | null, info: { listened: number; manual: boolean }) => void)[],
  queueLow: [] as ((remaining: number) => void)[],
  notice: [] as ((msg: string) => void)[],
  crossfadeSec: 3
}

const fullId = (t: Track) => (t.accessKey ? `${t.id}_${t.accessKey}` : t.id)

/** Запасной источник: трек не грузится — ищем его же на другом сервисе (ВК ↔ SoundCloud). */
async function fallbackUrl(t: Track): Promise<string> {
  try {
    const q = `${t.artist} ${t.title}`
    if (t.src === 'sc') {
      const r = await window.api.invoke('vk:search', q)
      const m = bestMatch(t, r.tracks)
      if (m?.url) { playerHooks.notice.forEach((f) => f('SoundCloud не отдал трек — играю его же из ВК')); return m.url }
    } else {
      const m = bestMatch(t, await window.api.invoke('sc:search', q))
      const u = m ? await window.api.invoke('sc:stream', m) : ''
      if (u) { playerHooks.notice.forEach((f) => f('ВК не отдал трек — играю его же с SoundCloud')); return u }
    }
  } catch { /* не нашли — плеер перейдёт к следующему */ }
  return ''
}

export const engine = new PlayerEngine()
export const player = createPlayer({
  engine,
  storage: localStorage,
  crossfadeSec: () => playerHooks.crossfadeSec,
  async resolveUrl(t) {
    try { const local = await window.api.invoke('dl:localPath', t.id); if (local) return local } catch { /* нет загрузок */ }
    if (t.src === 'sc') return window.api.invoke('sc:stream', t).catch(() => '')
    return t.url
  },
  async refreshUrl(t) {
    if (t.src === 'sc') {
      const u = await window.api.invoke('sc:stream', t).catch(() => '')
      return u || fallbackUrl(t)
    }
    const [fresh] = await window.api.invoke('vk:byId', [fullId(t)]).catch(() => [] as Track[])
    return fresh?.available && fresh.url ? fresh.url : fallbackUrl(t)
  },
  onNotice: (m) => playerHooks.notice.forEach((f) => f(m)),
  onTrackChange: (p, n, i) => playerHooks.trackChange.forEach((f) => f(p, n, i)),
  onQueueLow: (r) => playerHooks.queueLow.forEach((f) => f(r))
})

export function usePlayer<T>(sel: (s: PlayerState) => T): T { return useStore(player, sel) }
