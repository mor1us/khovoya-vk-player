import type { Repeat } from './queue'

/** Кривая равной мощности: в середине перехода нет провала громкости. */
export function gains(t: number): { out: number; in: number } {
  if (t <= 0) return { out: 1, in: 0 }
  const x = Math.min(1, t)
  return { out: Math.cos((x * Math.PI) / 2), in: Math.sin((x * Math.PI) / 2) }
}

export const MANUAL_FADE = 0.3

export type FadePlan = { startAt: number | null; length: number; preloadAt?: number }

export function fadePlan(o: { duration: number; crossfadeSec: number; repeat: Repeat; manual: boolean }): FadePlan {
  if (o.manual) return { startAt: 0, length: MANUAL_FADE }
  const preloadAt = Math.max(0, o.duration - 10)
  if (o.repeat === 'one' || o.duration < 30 || o.crossfadeSec <= 0) return { startAt: null, length: 0, preloadAt }
  const startAt = Math.max(0, o.duration - o.crossfadeSec)
  return { startAt, length: o.crossfadeSec, preloadAt: Math.max(0, startAt - 10) }
}

/** Протухшая ссылка: один перезапрос, вторая ошибка — пропуск трека. */
export async function withUrlRefresh(url: string, load: (u: string) => Promise<void>, refresh: () => Promise<string>): Promise<'ok' | 'skip'> {
  if (url) {
    try { await load(url); return 'ok' } catch { /* попробуем свежую ссылку */ }
  }
  const fresh = await refresh().catch(() => '')
  if (!fresh) return 'skip'
  try { await load(fresh); return 'ok' } catch { return 'skip' }
}
