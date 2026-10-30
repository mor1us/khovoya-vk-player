import type { Track } from '../../shared/types'

export const FRESH_DAYS = 14
export type MyArtist = { key: string; name: string; id?: string; count: number; cover?: string }

/** Главный исполнитель трека: из main_artists ВК или первое имя до «feat.», «,», «&». */
function mainArtist(t: Track): { id?: string; name: string } | null {
  if (t.artists?.length) return t.artists[0]
  const name = t.artist.split(/\s+(?:feat\.?|ft\.?|x|&)\s+|,/i)[0].trim()
  return name && name !== 'Неизвестен' ? { name } : null
}

/** Самые частые исполнители в твоей музыке. Список «Моё» идёт от новых к старым — обложку берём у самого свежего. */
export function topArtists(mine: Track[], n: number): MyArtist[] {
  const map = new Map<string, MyArtist>()
  for (const t of mine) {
    const a = mainArtist(t)
    if (!a) continue
    const key = a.name.trim().toLowerCase()
    const cur = map.get(key)
    if (cur) { cur.count++; if (!cur.id && a.id) cur.id = a.id; if (!cur.cover && t.coverUrl) cur.cover = t.coverUrl }
    else map.set(key, { key, name: a.name.trim(), id: a.id, count: 1, cover: t.coverUrl })
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, n)
}

export function isFresh(dateSec: number | undefined, now: number): boolean {
  return !!dateSec && now / 1000 - dateSec <= FRESH_DAYS * 86400
}
