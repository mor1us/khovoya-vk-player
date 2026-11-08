import type { Playlist } from '../../shared/types'

/**
 * Где человек был. Одной вкладки мало: на вкладке «Плейлист» можно побывать десять раз
 * с разными плейлистами, и «назад» должно вернуть именно тот, который он смотрел.
 */
export type Spot = {
  tab: string
  playlist: Playlist | null
  artist: { id?: string; name: string; cover?: string; src?: 'vk' | 'sc' } | null
  submitted: string
}

export const sameSpot = (a: Spot, b: Spot): boolean =>
  a.tab === b.tab && a.submitted === b.submitted && (a.playlist?.id ?? null) === (b.playlist?.id ?? null) &&
  (a.artist?.name ?? null) === (b.artist?.name ?? null) && (a.artist?.src ?? null) === (b.artist?.src ?? null)

const LIMIT = 30

/** Переход вперёд по своей воле: прошлое запоминаем, «вперёд» обнуляется — как в браузере. */
export function pushSpot(history: Spot[], from: Spot, to: Spot): { history: Spot[]; ahead: Spot[] } | null {
  if (sameSpot(from, to)) return null
  return { history: [...history, from].slice(-LIMIT), ahead: [] }
}

/** Шаг назад: последнее место становится текущим, а нынешнее уходит в «вперёд». */
export function stepBack(history: Spot[], ahead: Spot[], now: Spot): { spot: Spot; history: Spot[]; ahead: Spot[] } | null {
  if (!history.length) return null
  return { spot: history[history.length - 1], history: history.slice(0, -1), ahead: [...ahead, now].slice(-LIMIT) }
}

/** Шаг вперёд — то же самое в другую сторону. */
export function stepForward(history: Spot[], ahead: Spot[], now: Spot): { spot: Spot; history: Spot[]; ahead: Spot[] } | null {
  if (!ahead.length) return null
  return { spot: ahead[ahead.length - 1], history: [...history, now].slice(-LIMIT), ahead: ahead.slice(0, -1) }
}
