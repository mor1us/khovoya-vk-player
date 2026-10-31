import type { Track } from '../../shared/types'

/** Общая выдача: треки ВК и SoundCloud через один, повторы (тот же артист и название) — один раз, ВК в приоритете. */
export function mergeSources(vk: Track[], sc: Track[]): Track[] {
  const key = (t: Track) => `${t.artist}|${t.title}`.toLowerCase().replace(/\s+/g, ' ').trim()
  const seen = new Set<string>()
  const out: Track[] = []
  const add = (t: Track | undefined) => { if (!t) return; const k = key(t); if (seen.has(k)) return; seen.add(k); out.push(t) }
  vk.forEach((t) => seen.add(key(t)))
  const scFresh = sc.filter((t) => !seen.has(key(t)))
  seen.clear()
  for (let i = 0; i < Math.max(vk.length, scFresh.length); i++) { add(vk[i]); add(scFresh[i]) }
  return out
}
