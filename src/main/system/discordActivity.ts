import type { Track } from '../../shared/types'

export type Activity = {
  type: 2
  details?: string
  state?: string
  largeImageKey: string
  largeImageText: string
  startTimestamp: number
  endTimestamp?: number
}

/** Discord требует 2..128 символов в строках статуса. */
const fit = (s: string) => { const x = s.trim().slice(0, 128); return x.length < 2 ? (x + '  ').slice(0, 2) : x }

export function buildActivity(t: Track | null, playing: boolean, positionSec: number, now: number): Activity | null {
  if (!t || !playing) return null
  const start = now - Math.round(positionSec * 1000)
  return {
    type: 2,
    details: fit(t.title),
    state: fit(t.artist),
    largeImageKey: t.coverUrl && /^https:\/\//.test(t.coverUrl) ? t.coverUrl : 'logo',
    largeImageText: 'Хвоя — музыка из ВК без рекламы',
    startTimestamp: start,
    ...(t.duration > 0 ? { endTimestamp: start + t.duration * 1000 } : {})
  }
}
