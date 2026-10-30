import type { Track, WaveMode, WaveProfile } from '../../shared/types'
import { artistKey } from './profile'

const MAX_PER_ARTIST = 2
const MIN_ARTIST_WEIGHT = -6

type Opts = {
  candidates: Track[]
  mine: Set<string>
  mode: WaveMode
  profile: WaveProfile
  recent: string[]
  now: number
  rnd: () => number
  size?: number
}

/** Отбор следующей пачки Волны. */
export function pickBatch(o: Opts): Track[] {
  const size = o.size ?? 20
  const banned = new Set(o.profile.banned)
  const recent = new Set(o.recent.slice(0, 300))
  const seen = new Set<string>()
  const ok = o.candidates.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    if (!t.available || banned.has(t.id) || recent.has(t.id)) return false
    const until = o.profile.snoozed[t.id]
    if (until && until > o.now) return false
    return (o.profile.artists[artistKey(t.artist)] ?? 0) >= MIN_ARTIST_WEIGHT
  })
  const score = (t: Track) => (o.profile.artists[artistKey(t.artist)] ?? 0) + o.rnd() * 4
  const rank = (xs: Track[]) => xs.map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s).map((x) => x.t)

  const fresh = rank(ok.filter((t) => !o.mine.has(t.id)))
  const own = rank(ok.filter((t) => o.mine.has(t.id)))

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
