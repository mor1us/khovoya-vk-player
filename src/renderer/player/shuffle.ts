import type { Track } from '../../shared/types'

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
export function smartShuffle(tracks: Track[], opts: { firstId?: string; recent: string[]; rnd?: () => number }): Track[] {
  const rnd = opts.rnd ?? cryptoRandom
  const recentSet = new Set(opts.recent)
  const first = opts.firstId ? tracks.find((t) => t.id === opts.firstId) : undefined
  const pool = tracks.filter((t) => t !== first && !recentSet.has(t.id))

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
  const tail = opts.recent.filter((id) => id !== first?.id).map((id) => byId.get(id)).filter((t): t is Track => !!t)
  return [...(first ? [first] : []), ...placed.map((p) => p.t), ...tail]
}
