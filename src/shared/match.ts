import type { Track } from './types'

/** Приводим название к сравнимому виду: без регистра, скобок «(prod. …)», feat и лишних знаков. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е')
    .replace(/\((?:prod|feat|ft)[^)]*\)|\[(?:prod|feat|ft)[^\]]*\]/g, ' ')
    .replace(/\b(?:feat|ft)\.?\s.*$/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Тот же трек на другом сервисе: совпадает название, артист пересекается, длина отличается не больше чем на 8 с. */
export function bestMatch(t: Track, cands: Track[]): Track | null {
  const title = norm(t.title), artist = norm(t.artist)
  let best: { t: Track; s: number } | null = null
  for (const c of cands) {
    if (!c.available) continue
    const ct = norm(c.title), ca = norm(c.artist)
    const titleOk = ct === title || (title.length >= 4 && (ct.startsWith(title) || ct.includes(` ${title}`) || title.startsWith(ct)))
    if (!titleOk) continue
    const artistOk = ca === artist || (artist.length >= 3 && (ca.includes(artist) || artist.includes(ca) || ct.includes(artist)))
    if (!artistOk) continue
    if (t.duration > 0 && c.duration > 0 && Math.abs(t.duration - c.duration) > 8) continue
    const s = (ct === title ? 2 : 0) + (ca === artist ? 2 : 0) - (t.duration && c.duration ? Math.abs(t.duration - c.duration) / 8 : 0)
    if (!best || s > best.s) best = { t: c, s }
  }
  return best?.t ?? null
}
