import type { Track, WaveMode, WaveProfile } from '../../shared/types'
import { trackKey } from '../../shared/match'
import { artistKey } from './profile'

const MAX_PER_ARTIST = 2
const MIN_ARTIST_WEIGHT = -6
/** Насколько сильно вкус может поднять трек. Вес артиста сжимаем, чтобы пара старых любимцев не затопила пачку. */
const TASTE_MAX = 6

type Opts = {
  candidates: Track[]
  mine: Set<string>
  /** Своё по ключу «артист — название»: твой трек узнаётся и в копии у другого владельца. */
  mineKeys?: string[]
  mode: WaveMode
  profile: WaveProfile
  recent: string[]
  /** Недавно игравшее, но ключами «артист — название»: та же песня в другой копии ВК тоже недавняя. */
  recentKeys?: string[]
  now: number
  rnd: () => number
  size?: number
  /** Доп. очки кандидата (источник, свежесть, настроение) — прибавляются к весу артиста. */
  boost?: (t: Track) => number
}

/** Отбор следующей пачки Волны. */
export function pickBatch(o: Opts): Track[] {
  const size = o.size ?? 20
  const banned = new Set(o.profile.banned)
  const bannedKeys = new Set(o.profile.bannedKeys ?? [])
  const recent = new Set(o.recent)
  const recentKeys = new Set(o.recentKeys ?? [])
  const snoozedKeys = o.profile.snoozedKeys ?? {}
  const mineKeys = new Set(o.mineKeys ?? [])
  const isMine = (t: Track) => o.mine.has(t.id) || mineKeys.has(trackKey(t))
  const seen = new Set<string>()
  const ok = o.candidates.filter((t) => {
    // В ВК один и тот же трек лежит у десятков владельцев: копии считаем одним треком,
    // иначе он приходит в пачке по два-три раза, а «не нравится» блокирует только одну копию.
    const k = trackKey(t)
    if (seen.has(k)) return false
    seen.add(k)
    if (!t.available || banned.has(t.id) || bannedKeys.has(k) || recent.has(t.id) || recentKeys.has(k)) return false
    const until = Math.max(o.profile.snoozed[t.id] ?? 0, snoozedKeys[k] ?? 0)
    if (until > o.now) return false
    return (o.profile.artists[artistKey(t.artist)] ?? 0) >= MIN_ARTIST_WEIGHT
  })
  /** Вкус: разница между весом 3 и 15 не должна быть решающей — иначе выдача упирается в одних артистов. */
  const taste = (t: Track) => TASTE_MAX * Math.tanh((o.profile.artists[artistKey(t.artist)] ?? 0) / TASTE_MAX)
  const score = (t: Track) => taste(t) + (o.boost?.(t) ?? 0) + o.rnd() * 4
  const rank = (xs: Track[]) => xs.map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s).map((x) => x.t)

  const fresh = rank(ok.filter((t) => !isMine(t)))
  const own = rank(ok.filter((t) => isMine(t)))

  const perArtist = new Map<string, number>()
  const out: Track[] = []
  const take = (from: Track[], limit: number) => {
    for (const t of from) {
      if (out.length >= size || limit <= 0) return
      if (out.includes(t)) continue
      const k = artistKey(t.artist)
      const c = perArtist.get(k) ?? 0
      if (c >= MAX_PER_ARTIST) continue
      perArtist.set(k, c + 1); out.push(t); limit--
    }
  }

  if (o.mode === 'new') take(fresh, size)
  else if (o.mode === 'fav') take(own, size)
  else {
    const wantNew = Math.round(size * 0.7)
    take(fresh, wantNew)
    take(own, size - out.length)
    take(fresh, size - out.length) // если своих мало — добираем новым
  }
  // перемешиваем внутри пачки, чтобы новое и своё чередовались
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(o.rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

/**
 * Сплести две пачки — ВК и SoundCloud. Строго через один звучит механически: слышно, что Волна
 * считает, а не подбирает. Берём отрезками по одному-два, начиная со случайной стороны;
 * когда одна сторона кончилась, остаток второй идёт подряд.
 */
export function blend<T>(a: T[], b: T[], rnd: () => number): T[] {
  const out: T[] = []
  const at = [0, 0]
  const src = [a, b]
  let side = rnd() < 0.5 ? 0 : 1
  while (at[0] < a.length || at[1] < b.length) {
    if (at[side] >= src[side].length) { side = 1 - side; continue }
    const take = rnd() < 0.4 ? 2 : 1 // иногда два подряд с одной стороны
    for (let k = 0; k < take && at[side] < src[side].length; k++) out.push(src[side][at[side]++])
    side = 1 - side
  }
  return out
}
