import type { Track, WaveProfile } from '../../shared/types'

export type Reaction = 'like' | 'finished' | 'earlySkip' | 'dislike'
export const DAY = 24 * 3600 * 1000
const SEEDS_MAX = 30
const DELTA: Record<Reaction, number> = { like: 3, finished: 1, earlySkip: -1, dislike: -5 }

export const artistKey = (a: string) => a.trim().toLowerCase()
export const emptyProfile = (): WaveProfile => ({ artists: {}, seeds: [], banned: [], snoozed: {}, reactions: 0 })

/** Реакция на трек меняет вес артиста. Профиль не мутируется. */
export function applyReaction(p: WaveProfile, t: Track, r: Reaction, now: number): WaveProfile {
  const key = artistKey(t.artist)
  const next: WaveProfile = {
    artists: { ...p.artists, [key]: (p.artists[key] ?? 0) + DELTA[r] },
    seeds: p.seeds, banned: p.banned, snoozed: p.snoozed, reactions: p.reactions + 1, disliked: p.disliked ?? []
  }
  if (r === 'like') next.seeds = [t.id, ...p.seeds.filter((s) => s !== t.id)].slice(0, SEEDS_MAX)
  if (r === 'finished' && !p.seeds.includes(t.id) && (p.artists[key] ?? 0) >= 2) next.seeds = [t.id, ...p.seeds].slice(0, SEEDS_MAX)
  if (r === 'earlySkip') next.snoozed = { ...p.snoozed, [t.id]: now + 7 * DAY }
  if (r === 'dislike') {
    next.banned = p.banned.includes(t.id) ? p.banned : [...p.banned, t.id]; next.seeds = next.seeds.filter((s) => s !== t.id)
    next.disliked = [{ ...t, url: '' }, ...(p.disliked ?? []).filter((x) => x.id !== t.id)].slice(0, 500)
  }
  return next
}

/** Вернуть трек из «Не нравится»: снова может попасть в Волну, вес артиста восстанавливается. */
export function undoDislike(p: WaveProfile, t: Track): WaveProfile {
  const key = artistKey(t.artist)
  const was = p.banned.includes(t.id)
  return {
    ...p,
    artists: was ? { ...p.artists, [key]: (p.artists[key] ?? 0) - DELTA.dislike } : p.artists,
    banned: p.banned.filter((x) => x !== t.id),
    disliked: (p.disliked ?? []).filter((x) => x.id !== t.id)
  }
}

/** 3–5 «зёрен»: самые свежие лайки, остальные случайно из более старых. */
export function seedsFor(p: WaveProfile, rnd: () => number): string[] {
  if (!p.seeds.length) return []
  const n = Math.min(p.seeds.length, 3 + Math.floor(rnd() * 3))
  const head = p.seeds.slice(0, 2)
  const rest = p.seeds.slice(2)
  const picked: string[] = []
  while (picked.length < n - head.length && rest.length) picked.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0])
  return [...head, ...picked].slice(0, n)
}

/** Какую реакцию засчитать треку, который только что сменился. */
export function reactionFor(prev: Track, info: { listened: number; manual: boolean }): Reaction | null {
  if (!info.manual) return 'finished'
  if (info.listened < 30) return 'earlySkip'
  if (prev.duration > 0 && info.listened >= prev.duration - 15) return 'finished'
  return null
}
