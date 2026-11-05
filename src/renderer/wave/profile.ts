import type { Track, WaveProfile } from '../../shared/types'
import { trackKey } from '../../shared/match'

export type Reaction = 'like' | 'finished' | 'midSkip' | 'earlySkip' | 'dislike'
export const DAY = 24 * 3600 * 1000
const SEEDS_MAX = 30
/** Банов и отдыхающих треков не держим больше этого: профиль читается при каждом старте. */
const BANNED_MAX = 2000
const SNOOZED_MAX = 1000
/** Вкус стареет: без новых реакций вес артиста слабеет вдвое за полтора месяца. */
const HALF_LIFE_MS = 45 * DAY
const DELTA: Record<Reaction, number> = { like: 3, finished: 1, midSkip: -0.5, earlySkip: -1, dislike: -5 }

export const artistKey = (a: string) => a.trim().toLowerCase()
export const emptyProfile = (): WaveProfile => ({ artists: {}, seeds: [], banned: [], snoozed: {}, reactions: 0 })

/**
 * Старение вкуса. Без этого артист, которого ты заслушивал полгода назад, навсегда остаётся
 * первым в выдаче. Совсем выдохшиеся забываем, чтобы профиль не рос без конца.
 */
export function decayArtists(artists: Record<string, number>, from: number, now: number): Record<string, number> {
  const passed = now - from
  if (!from || passed < DAY) return artists
  const k = Math.pow(0.5, passed / HALF_LIFE_MS)
  const out: Record<string, number> = {}
  for (const [a, w] of Object.entries(artists)) {
    const v = Math.round(w * k * 100) / 100
    if (Math.abs(v) >= 0.2) out[a] = v
  }
  return out
}

/** Оставить в словаре отдыхающих только самые свежие записи. */
function trimSnoozed(snoozed: Record<string, number>): Record<string, number> {
  const all = Object.entries(snoozed)
  if (all.length <= SNOOZED_MAX) return snoozed
  return Object.fromEntries(all.sort((a, b) => b[1] - a[1]).slice(0, SNOOZED_MAX))
}

/** Реакция на трек меняет вес артиста. Профиль не мутируется. */
export function applyReaction(p: WaveProfile, t: Track, r: Reaction, now: number): WaveProfile {
  const key = artistKey(t.artist)
  const tk = trackKey(t)
  const artists = decayArtists(p.artists, p.at ?? 0, now)
  const next: WaveProfile = {
    artists: { ...artists, [key]: (artists[key] ?? 0) + DELTA[r] },
    seeds: p.seeds, banned: p.banned, bannedKeys: p.bannedKeys ?? [],
    snoozed: p.snoozed, snoozedKeys: p.snoozedKeys ?? {},
    reactions: p.reactions + 1, disliked: p.disliked ?? [], at: now
  }
  if (r === 'like') next.seeds = [t.id, ...p.seeds.filter((s) => s !== t.id)].slice(0, SEEDS_MAX)
  if (r === 'finished' && !p.seeds.includes(t.id) && (artists[key] ?? 0) >= 2) next.seeds = [t.id, ...p.seeds].slice(0, SEEDS_MAX)
  if (r === 'earlySkip') {
    // отдыхает и сам трек, и его копии у других владельцев ВК
    next.snoozed = trimSnoozed({ ...p.snoozed, [t.id]: now + 7 * DAY })
    next.snoozedKeys = trimSnoozed({ ...(p.snoozedKeys ?? {}), [tk]: now + 7 * DAY })
  }
  if (r === 'dislike') {
    next.banned = p.banned.includes(t.id) ? p.banned : [...p.banned, t.id].slice(-BANNED_MAX)
    next.bannedKeys = (p.bannedKeys ?? []).includes(tk) ? (p.bannedKeys ?? []) : [...(p.bannedKeys ?? []), tk].slice(-BANNED_MAX)
    next.seeds = next.seeds.filter((s) => s !== t.id)
    next.disliked = [{ ...t, url: '' }, ...(p.disliked ?? []).filter((x) => x.id !== t.id)].slice(0, 500)
  }
  return next
}

/** Вернуть трек из «Не нравится»: снова может попасть в Волну, вес артиста восстанавливается. */
export function undoDislike(p: WaveProfile, t: Track): WaveProfile {
  const key = artistKey(t.artist)
  const tk = trackKey(t)
  const was = p.banned.includes(t.id) || (p.bannedKeys ?? []).includes(tk)
  return {
    ...p,
    artists: was ? { ...p.artists, [key]: (p.artists[key] ?? 0) - DELTA.dislike } : p.artists,
    banned: p.banned.filter((x) => x !== t.id),
    bannedKeys: (p.bannedKeys ?? []).filter((x) => x !== tk),
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

/** «Сразу пропустил» — это 30 секунд, но у короткого трека четверть длины наступает раньше. */
export const earlyLimit = (duration: number) => (duration > 0 ? Math.min(30, duration * 0.25) : 30)

/**
 * Какую реакцию засчитать треку, который только что сменился.
 * Музыка, доигравшая сама в свёрнутом окне, — не твой выбор: вес артисту за неё не идёт,
 * иначе фоновое слушание потихоньку поднимает всех подряд и вкус размывается.
 */
export function reactionFor(prev: Track, info: { listened: number; manual: boolean; background?: boolean }): Reaction | null {
  if (!info.manual) return info.background ? null : 'finished'
  if (info.listened < earlyLimit(prev.duration)) return 'earlySkip'
  if (prev.duration > 0 && info.listened >= prev.duration - 15) return 'finished'
  return 'midSkip' // переключил на середине — слабый минус, раньше это не считалось вообще
}
