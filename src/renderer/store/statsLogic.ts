import type { Track } from '../../shared/types'
import type { HistoryEntry } from './historyLogic'

/**
 * Что Хвоя помнит про каждый трек. Записи куда легче полной истории: ни названия, ни обложки,
 * только цифры — поэтому их можно хранить долго и не затирать, как 500 последних прослушиваний.
 */
export type TrackStat = {
  /** Сколько раз включал. */
  plays: number
  /** Когда включил впервые и в последний раз. */
  firstAt: number
  lastAt: number
  /** Сколько раз трек попадался в Волне. */
  wave: number
  /** Сколько раз дослушал до конца и сколько раз переключил. */
  done: number
  skip: number
}

export type Stats = Record<string, TrackStat>

const EMPTY: TrackStat = { plays: 0, firstAt: 0, lastAt: 0, wave: 0, done: 0, skip: 0 }
export const statOf = (s: Stats, id: string): TrackStat => s[id] ?? EMPTY

/** Столько треков помним. Дальше выбрасываем те, что слушали давно и мало. */
export const STATS_MAX = 5000

/** Прибавить событие. Новая запись не меняет старую — иначе окно не заметит перемену. */
export function bump(s: Stats, id: string, at: number, what: Partial<Record<keyof TrackStat, number>>): Stats {
  const cur = s[id] ?? EMPTY
  const next: TrackStat = {
    plays: cur.plays + (what.plays ?? 0),
    wave: cur.wave + (what.wave ?? 0),
    done: cur.done + (what.done ?? 0),
    skip: cur.skip + (what.skip ?? 0),
    firstAt: cur.firstAt || at,
    lastAt: what.plays ? at : cur.lastAt
  }
  return { ...s, [id]: next }
}

/** Когда записей слишком много, расстаёмся с теми, что слушали давно и редко. */
export function trim(s: Stats, max = STATS_MAX): Stats {
  const ids = Object.keys(s)
  if (ids.length <= max) return s
  const rank = (id: string) => s[id].plays * 1e12 + s[id].lastAt
  const keep = ids.sort((a, b) => rank(b) - rank(a)).slice(0, max)
  const out: Stats = {}
  for (const id of keep) out[id] = s[id]
  return out
}

/**
 * Счётчики из уже накопленной истории — чтобы сведения не начинались с нуля в день,
 * когда они появились. История идёт от новых к старым.
 */
export function fromHistory(h: HistoryEntry[]): Stats {
  const out: Stats = {}
  for (let i = h.length - 1; i >= 0; i--) out[h[i].track.id] = bump(out, h[i].track.id, h[i].at, { plays: 1 })[h[i].track.id]
  return out
}

/** Самое заслушанное — для экрана «Заслушанное». */
export function topPlayed(s: Stats, n: number): { id: string; stat: TrackStat }[] {
  return Object.entries(s).filter(([, v]) => v.plays > 0).sort((a, b) => b[1].plays - a[1].plays || b[1].lastAt - a[1].lastAt)
    .slice(0, n).map(([id, stat]) => ({ id, stat }))
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

/** «сегодня в 02:08», «вчера в 23:40», «3 марта 2026». Без технических дат. */
export function whenText(at: number, now: number): string {
  if (!at) return 'никогда'
  const d = new Date(at), n = new Date(now)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  if (day(d) === day(n)) return `сегодня в ${time}`
  if (day(d) === day(new Date(now - 86_400_000))) return `вчера в ${time}`
  const year = d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`
}

/** «7 раз», «1 раз», «21 раз», «22 раза» — по-русски. */
export function timesText(n: number): string {
  const ten = n % 100
  if (ten >= 11 && ten <= 14) return `${n} раз`
  const one = n % 10
  return `${n} ${one === 1 ? 'раз' : one >= 2 && one <= 4 ? 'раза' : 'раз'}`
}

/** Короткая строка для подсказки под курсором. */
export function statSummary(stat: TrackStat, t: Track, now: number): string {
  const parts: string[] = []
  parts.push(stat.plays ? `Слушал ${timesText(stat.plays)}, последний раз ${whenText(stat.lastAt, now)}` : 'Ещё ни разу не слушал в Хвое')
  if (stat.wave) parts.push(`В Волне попадался ${timesText(stat.wave)}`)
  if (t.addedAt && t.src !== 'sc') parts.push(`Добавлен ${whenText(t.addedAt * 1000, now)}`)
  return parts.join('\n')
}
