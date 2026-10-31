import { create } from 'zustand'
import type { Track, WaveMode, WaveProfile } from '../../shared/types'
import { applyReaction, emptyProfile, reactionFor, seedsFor, undoDislike, type Reaction } from '../wave/profile'
import { pickBatch } from '../wave/picker'
import { cryptoRandom } from '../player/shuffle'
import { useLibrary } from './library'
import { useSc } from './sc'
import { applyTune, modeFor, normalizeTune, tuneQueries, type WaveTune } from '../wave/tune'
import { player } from './playerInstance'

export type WaveKind = 'vk' | 'sc' | 'both'

type Wave = {
  mode: WaveMode
  tune: WaveTune
  setTune(t: WaveTune): void
  profile: WaveProfile
  loading: boolean
  /** Какая из Волн сейчас собирается: ВК, SoundCloud или обе вперемешку. */
  loadingKind: WaveKind | null
  startKind(kind: WaveKind): Promise<void>
  setMode(m: WaveMode): void
  load(): Promise<void>
  start(mode?: WaveMode): Promise<void>
  react(t: Track, r: Reaction): void
  like(t: Track): Promise<void>
  /** Сердечко в плеере: лайк ↔ снять лайк. */
  toggleLike(t: Track): Promise<string>
  isLiked(t: Track): boolean
  dislike(t: Track): Promise<void>
  undislike(t: Track): void
}

const recent = (): string[] => { try { return JSON.parse(localStorage.getItem('recent') ?? '[]') } catch { return [] } }
const isWave = () => player.getState().source.startsWith('wave:')
let fetching = false

async function candidates(profile: WaveProfile): Promise<Track[]> {
  const seeds = seedsFor(profile, cryptoRandom).filter((id) => !id.startsWith('sc_')) // рекомендации ВК — только по трекам ВК
  const cur = player.getState().current
  if (cur && !seeds.includes(cur.id)) seeds.unshift(cur.id)
  const reqs = [window.api.invoke<Track[]>('vk:recommendations', undefined, 100), ...seeds.slice(0, 5).map((s) => window.api.invoke<Track[]>('vk:recommendations', s, 40))]
  const res = await Promise.allSettled(reqs)
  const recs = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (!recs.length) { // рекомендации ВК недоступны → похожие через поиск по любимым артистам
    const top = Object.entries(profile.artists).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a]) => a)
    const s = await Promise.allSettled(top.map((a) => window.api.invoke<{ tracks: Track[] }>('vk:search', a)))
    recs.push(...s.flatMap((r) => (r.status === 'fulfilled' ? r.value.tracks.slice(0, 15) : [])))
  }
  return [...recs, ...(await useLibrary.getState().loadMine())]
}

const readTune = (): WaveTune => { try { return normalizeTune(JSON.parse(localStorage.getItem('waveTune') ?? 'null')) } catch { return normalizeTune(null) } }

/** Поиски ВК под настройки Волны (настроение/язык/новинки). Возвращает треки и их id как «подходящие». */
async function tuneCandidates(tune: WaveTune, profile: WaveProfile): Promise<Track[]> {
  const top = Object.entries(profile.artists).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a]) => a)
  const qs = tuneQueries(tune, top)
  if (!qs.length) return []
  const s = await Promise.allSettled(qs.map((x) => window.api.invoke<{ tracks: Track[] }>('vk:search', x.q, 0, x.byDate)))
  return s.flatMap((r) => (r.status === 'fulfilled' ? r.value.tracks.slice(0, 40) : []))
}

const FALLBACK_SC = ['phonk', 'lofi hip hop', 'indie', 'hyperpop', 'drill', 'chill beats', 'russian rap', 'slowed reverb']

/** Кандидаты SoundCloud: похожие на твои лайки SC и текущий трек, любимые артисты, настройки Волны. */
async function scCandidates(profile: WaveProfile, tune: WaveTune): Promise<{ cands: Track[]; extra: Set<string>; likes: Track[] }> {
  const likes = await useSc.getState().load()
  const cur = player.getState().current
  const seeds = [...likes].sort(() => cryptoRandom() - 0.5).slice(0, 4)
  if (cur?.src === 'sc' && !seeds.some((t) => t.id === cur.id)) seeds.unshift(cur)
  let top = Object.entries(profile.artists).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a]) => a)
  if (!top.length) { // новичок: берём артистов из «Моей музыки»
    const cnt = new Map<string, number>()
    for (const t of useLibrary.getState().mine.slice(0, 300)) cnt.set(t.artist, (cnt.get(t.artist) ?? 0) + 1)
    top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a]) => a)
  }
  const qs = tuneQueries(tune, [])
  const [rel, byArtist, byTune] = await Promise.all([
    Promise.allSettled(seeds.map((t) => window.api.invoke<Track[]>('sc:related', t))),
    Promise.allSettled((top.length ? top : FALLBACK_SC.sort(() => cryptoRandom() - 0.5).slice(0, 3)).map((a) => window.api.invoke<Track[]>('sc:search', a))),
    Promise.allSettled(qs.map((x) => window.api.invoke<Track[]>('sc:search', x.q)))
  ])
  const ok = (r: PromiseSettledResult<Track[]>[]) => r.flatMap((x) => (x.status === 'fulfilled' ? x.value : []))
  const tuned = ok(byTune)
  return { cands: [...tuned, ...ok(rel), ...ok(byArtist), ...likes], extra: new Set(tuned.map((t) => t.id)), likes }
}

async function scBatch(mode: WaveMode, profile: WaveProfile, size = 20, tune: WaveTune = useWave.getState().tune): Promise<Track[]> {
  const { cands, extra, likes } = await scCandidates(profile, tune)
  const queued = new Set(player.getState().queue?.list().map((t) => t.id) ?? [])
  const pool = applyTune(cands.filter((t) => !queued.has(t.id) && t.duration < 15 * 60), tune, extra, Date.now(), size)
  return pickBatch({ candidates: pool, mine: new Set(likes.map((t) => t.id)), mode, profile, recent: recent(), now: Date.now(), rnd: cryptoRandom, size })
}

/** ВК и SoundCloud через один. */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] !== undefined) out.push(a[i]); if (b[i] !== undefined) out.push(b[i]) }
  return out
}

async function batchFor(kind: WaveKind, size = 20): Promise<Track[]> {
  const w = useWave.getState()
  if (kind === 'sc') return scBatch(w.mode, w.profile, size)
  if (kind === 'both') {
    const [v, c] = await Promise.all([batch(w.mode, w.profile, Math.ceil(size / 2)).catch(() => [] as Track[]), scBatch(w.mode, w.profile, Math.ceil(size / 2)).catch(() => [] as Track[])])
    return interleave(v, c)
  }
  return batch(w.mode, w.profile, size)
}

export const kindOf = (source: string): WaveKind => (source === 'wave:sc' ? 'sc' : source === 'wave:both' ? 'both' : 'vk')

async function batch(mode: WaveMode, profile: WaveProfile, size = 20, tune: WaveTune = useWave.getState().tune): Promise<Track[]> {
  const mine = new Set(useLibrary.getState().mine.map((t) => t.id))
  const [base, extra] = await Promise.all([candidates(profile), tuneCandidates(tune, profile).catch(() => [] as Track[])])
  const queued = new Set(player.getState().queue?.list().map((t) => t.id) ?? [])
  const cand = applyTune([...extra, ...base].filter((t) => !queued.has(t.id)), tune, new Set(extra.map((t) => t.id)), Date.now(), size)
  return pickBatch({ candidates: cand, mine, mode, profile, recent: recent(), now: Date.now(), rnd: cryptoRandom, size })
}

export const useWave = create<Wave>((set, get) => ({
  mode: modeFor(readTune()),
  tune: readTune(),
  setTune(t) { localStorage.setItem('waveTune', JSON.stringify(t)); set({ tune: t, mode: modeFor(t) }) },
  profile: emptyProfile(),
  loading: false,
  loadingKind: null,
  async startKind(kind) {
    if (kind === 'vk') return get().start()
    set({ loadingKind: kind })
    try {
      const b = await batchFor(kind)
      if (!b.length) throw new Error(kind === 'sc' ? 'SoundCloud сейчас ничего не отдал. Попробуй ещё раз чуть позже' : 'Не получилось собрать Волну')
      await player.getState().playList(b, b[0].id, `wave:${kind}`)
    } finally { set({ loadingKind: null }) }
  },
  setMode(m) { localStorage.setItem('waveMode', m); set({ mode: m }) },
  async load() { try { set({ profile: (await window.api.invoke<WaveProfile | null>('wave:get')) ?? emptyProfile() }) } catch { /* пустой профиль */ } },
  async start(mode) {
    const m = mode ?? get().mode
    set({ loading: true, loadingKind: 'vk' })
    try {
      const b = await batch(m, get().profile)
      if (b.length) await player.getState().playList(b, b[0].id, `wave:${m}`)
    } finally { set({ loading: false, loadingKind: null }) }
  },
  react(t, r) {
    const profile = applyReaction(get().profile, t, r, Date.now())
    set({ profile })
    void window.api.invoke('wave:set', profile).catch(() => {})
  },
  async like(t) {
    get().react(t, 'like')
    if (t.src === 'sc') { if (!useSc.getState().isLiked(t.id)) await useSc.getState().toggle(t); return }
    if (!useLibrary.getState().isMine(t.id)) {
      await window.api.invoke('vk:add', t)
      useLibrary.getState().setMine([t, ...useLibrary.getState().mine])
    }
  },
  isLiked(t) { return t.src === 'sc' ? useSc.getState().isLiked(t.id) : useLibrary.getState().isMine(t.id) },
  async toggleLike(t) {
    const lib = useLibrary.getState()
    if (t.src === 'sc') { // в ВК не добавить — лайк живёт в «Моё · SoundCloud»
      const on = await useSc.getState().toggle(t)
      if (on) get().react(t, 'like')
      else { const profile = { ...get().profile, seeds: get().profile.seeds.filter((s) => s !== t.id) }; set({ profile }); void window.api.invoke('wave:set', profile).catch(() => {}) }
      return on ? 'Добавлено в «Моё · SoundCloud»' : 'Убрано из «Моё · SoundCloud»'
    }
    if (lib.isMine(t.id)) {
      await window.api.invoke('vk:remove', t)
      lib.setMine(lib.mine.filter((x) => x.id !== t.id))
      return 'Убрано из твоей музыки'
    }
    await get().like(t)
    return 'Добавлено в твою музыку'
  },
  async dislike(t) {
    get().react(t, 'dislike')
    if (player.getState().current?.id === t.id) await player.getState().next()
  },
  undislike(t) {
    const profile = undoDislike(get().profile, t)
    set({ profile })
    void window.api.invoke('wave:set', profile).catch(() => {})
  }
}))

/** Подключение Волны к плееру: реакции при смене трека и подгрузка, когда очередь кончается. */
export function bindWave() {
  return {
    onTrackChange(prev: Track | null, _next: Track | null, info: { listened: number; manual: boolean }) {
      if (!prev || !isWave()) return
      const r = reactionFor(prev, info)
      if (r) useWave.getState().react(prev, r)
    },
    async onQueueLow(remaining: number) {
      if (!isWave() || remaining > 5 || fetching) return
      fetching = true
      try {
        const b = await batchFor(kindOf(player.getState().source))
        if (b.length) player.getState().append(b)
      } finally { fetching = false }
    }
  }
}

/** Подборка по вкусу Волны (для миксов «Для вас»). */
export function waveBatch(mode: WaveMode, size: number): Promise<Track[]> { return batch(mode, useWave.getState().profile, size, normalizeTune(null)) }
