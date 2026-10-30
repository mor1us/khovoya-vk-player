import type { Track } from '../../shared/types'

export const HISTORY_MAX = 500
export type HistoryEntry = { track: Track; at: number }

/** Новое прослушивание в начало. Ссылку на поток не храним — она всё равно протухнет. */
export function pushHistory(h: HistoryEntry[], t: Track, at: number): HistoryEntry[] {
  const clean: Track = { ...t, url: '' }
  if (h[0]?.track.id === t.id) return [{ track: clean, at }, ...h.slice(1)]
  return [{ track: clean, at }, ...h].slice(0, HISTORY_MAX)
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function groupByDay(h: HistoryEntry[], now: number): { label: string; items: HistoryEntry[] }[] {
  const today = new Date(now), yest = new Date(now - 86_400_000)
  const out: { label: string; key: string; items: HistoryEntry[] }[] = []
  for (const e of h) {
    const d = new Date(e.at), key = dayKey(d)
    let g = out.find((x) => x.key === key)
    if (!g) {
      const label = key === dayKey(today) ? 'Сегодня' : key === dayKey(yest) ? 'Вчера'
        : `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : ''}`
      g = { label, key, items: [] }; out.push(g)
    }
    g.items.push(e)
  }
  return out.map(({ label, items }) => ({ label, items }))
}
