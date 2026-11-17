import type { Track } from '../../shared/types'
import { trackKey } from '../../shared/match'

/** Случайное число [0,1) из криптогенератора — без перекосов Math.random. */
export function cryptoRandom(): number {
  const a = new Uint32Array(1)
  globalThis.crypto.getRandomValues(a)
  return a[0] / 2 ** 32
}

/** Честная перетасовка Фишера — Йетса. */
export function fisherYates<T>(xs: T[], rnd: () => number = cryptoRandom): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Умное перемешивание:
 * 1) Фишер — Йетс; 2) треки одного артиста раскладываются равномерно по всей очереди
 * со случайным сдвигом; 3) недавно игравшие уходят в конец; 4) firstId — первым.
 */
export function smartShuffle(tracks: Track[], opts: { firstId?: string; recent: string[]; recentKeys?: string[]; rnd?: () => number }): Track[] {
  const rnd = opts.rnd ?? cryptoRandom
  const recentSet = new Set(opts.recent)
  const recentKeySet = new Set(opts.recentKeys ?? [])
  for (const t of tracks) if (recentSet.has(t.id)) recentKeySet.add(trackKey(t))
  const first = opts.firstId ? tracks.find((t) => t.id === opts.firstId) : undefined
  const isRecent = (t: Track) => recentSet.has(t.id) || recentKeySet.has(trackKey(t))
  const pool = tracks.filter((t) => t !== first && !isRecent(t))

  const groups = new Map<string, Track[]>()
  for (const t of fisherYates(pool, rnd)) {
    const key = t.artist.trim().toLowerCase()
    const g = groups.get(key)
    if (g) g.push(t); else groups.set(key, [t])
  }
  const placed: { t: Track; pos: number }[] = []
  for (const g of groups.values()) {
    const k = g.length
    const offset = rnd() / k
    g.forEach((t, i) => placed.push({ t, pos: offset + i / k + (rnd() - 0.5) * (0.2 / k) }))
  }
  placed.sort((a, b) => a.pos - b.pos)

  const byId = new Map(tracks.map((t) => [t.id, t]))
  const tail: Track[] = []
  const tailKeys = new Set<string>(first ? [trackKey(first)] : [])
  for (const id of opts.recent) {
    const t = byId.get(id)
    if (!t || t === first || tailKeys.has(trackKey(t))) continue
    tailKeys.add(trackKey(t))
    tail.push(t)
  }
  for (const t of tracks) {
    const key = trackKey(t)
    if (t === first || !recentKeySet.has(key) || tailKeys.has(key)) continue
    tailKeys.add(key)
    tail.push(t)
  }
  return [...(first ? [first] : []), ...placed.map((p) => p.t), ...tail]
}
