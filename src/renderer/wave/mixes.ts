import type { Track } from '../../shared/types'
import { fisherYates } from '../player/shuffle'
import { artistKey } from './profile'

/** «Забытое любимое»: твои треки, которых не было среди недавно прослушанных, не больше 3 на артиста. */
export function forgottenFavs(mine: Track[], recent: string[], n: number, rnd: () => number): Track[] {
  const rec = new Set(recent)
  let pool = mine.filter((t) => t.available && !rec.has(t.id))
  if (pool.length < n) pool = mine.filter((t) => t.available) // всё недавно слушал — берём из всей музыки
  const per = new Map<string, number>()
  const out: Track[] = []
  for (const t of fisherYates(pool, rnd)) {
    const k = artistKey(t.artist), c = per.get(k) ?? 0
    if (c >= 3) continue
    per.set(k, c + 1); out.push(t)
    if (out.length >= n) break
  }
  return out
}
