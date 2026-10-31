import { create } from 'zustand'
import type { Track, WaveMode, WaveProfile } from '../../shared/types'
import { applyReaction, emptyProfile, reactionFor, seedsFor, undoDislike, type Reaction } from '../wave/profile'
import { pickBatch } from '../wave/picker'
import { cryptoRandom } from '../player/shuffle'
import { useLibrary } from './library'
import { useSc } from './sc'
import { applyTune, artistLangMap, matchLangs, modeFor, normalizeTune, tuneBoost, tuneQueries, type WaveTune } from '../wave/tune'
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

const readTune = (): WaveTune => { try { return normalizeTune(JSON.parse(localStorage.getItem('waveTune') ?? 'null')) } catch { return normalizeTune(null) } }

/** Сколько очков даёт источник: персональные подборки ВК и свежее у любимых артистов ценнее общего поиска. */
const SRC = { daily: 4, fresh: 3, recSeed: 3, rec: 2, mood: 1, mine: 0 } as const

/** Треки персональных подборок ВК («Для вас», «Открытия», «Новинки», «Плейлисты дня») — держим 30 минут. */
let algo: { at: number; tracks: Track[] } | null = null
async function algoTracks(): Promise<Track[]> {
  if (algo && Date.now() - algo.at < 30 * 60_000) return algo.tracks
  await useLibrary.getState().loadForYou()
  const pls = (useLibrary.getState().forYou ?? []).flatMap((b) => b.playlists)
    .filter((p) => /для вас|открыти|новинк|плейлист\s*дня/i.test(p.title)).slice(0, 8)
  const res = await Promise.allSettled(pls.map((p) => window.api.invoke<Track[]>('vk:playlistTracks', p)))
  algo = { at: Date.now(), tracks: res.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])) }
  return algo.tracks
}

/** Любимые артисты: по реакциям в Волне, а если их мало — по «Моей музыке». */
function topArtists(profile: WaveProfile, mine: Track[], n: number): string[] {
  const fromWave = Object.entries(profile.artists).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).map(([a]) => a)
  const cnt = new Map<string, number>()
  for (const t of mine.slice(0, 500)) cnt.set(t.artist, (cnt.get(t.artist) ?? 0) + 1)
  const fromMine = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a.toLowerCase())
  return [...new Set([...fromWave, ...fromMine])].slice(0, n)
}

type Pool = { cands: Track[]; source: Map<string, number>; moodHits: Set<string>; artists: Map<string, boolean> }

/**
 * Кандидаты Волны ВК. Источники:
 *  1) персональные подборки ВК (Для вас, Открытия, Новинки, Плейлисты дня),
 *  2) рекомендации ВК — общие и «похожее на» твои лайки (под выбранный язык),
 *  3) свежие треки твоих любимых артистов (сначала новые),
 *  4) поиск по настроению,
 *  5) твоя музыка — только для «Знакомого» и для микса.
 */
async function vkPool(profile: WaveProfile, tune: WaveTune, mode: WaveMode): Promise<Pool> {
  const mine = await useLibrary.getState().loadMine()
  const mineArtists = artistLangMap(mine)
  const byId = new Map(mine.map((t) => [t.id, t]))
  const lang = tune.lang
  // зёрна для «похожего»: твои лайки, а при выбранном языке — только подходящие под него
  let seeds = seedsFor(profile, cryptoRandom).filter((id) => !id.startsWith('sc_'))
  if (lang.length) {
    seeds = seeds.filter((id) => { const t = byId.get(id); return !t || matchLangs(t, lang, mineArtists) })
    if (seeds.length < 3) {
      const fit = mine.slice(0, 400).filter((t) => matchLangs(t, lang, mineArtists))
      for (let i = 0; i < 4 && fit.length; i++) seeds.push(fit.splice(Math.floor(cryptoRandom() * fit.length), 1)[0].id)
    }
  }
  const cur = player.getState().current
  if (cur && cur.src !== 'sc' && !seeds.includes(cur.id) && (!lang.length || matchLangs(cur, lang, mineArtists))) seeds.unshift(cur.id)
  // любимые артисты под выбранный язык — у них берём свежее
  let top = topArtists(profile, mine, 12)
  const words = lang.filter((l) => l !== 'none')
  if (words.length) top = top.filter((a) => { const ru = mineArtists.get(a); return ru === undefined || words.some((w) => (w === 'ru') === ru) })
  const qs = tuneQueries(tune, top)
  const list = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null)
  const [general, bySeed, daily, searched] = await Promise.all([
    window.api.invoke<Track[]>('vk:recommendations', undefined, 100).catch(() => [] as Track[]),
    Promise.allSettled(seeds.slice(0, 5).map((s) => window.api.invoke<Track[]>('vk:recommendations', s, 40))),
    algoTracks().catch(() => [] as Track[]),
    Promise.allSettled(qs.map((x) => window.api.invoke<{ tracks: Track[] }>('vk:search', x.q, 0, x.byDate).then((r) => ({ x, tracks: r.tracks.slice(0, x.byDate ? 15 : 30) }))))
  ])
  const source = new Map<string, number>()
  const moodHits = new Set<string>()
  const cands: Track[] = []
  const add = (ts: Track[], q: number) => { for (const t of ts) { cands.push(t); source.set(t.id, Math.max(source.get(t.id) ?? -9, q)) } }
  add(daily, SRC.daily)
  add(bySeed.flatMap((r) => list(r) ?? []), SRC.recSeed)
  add(general, SRC.rec)
  for (const r of searched) {
    const v = list(r); if (!v) continue
    const isArtist = top.includes(v.x.q)
    add(v.tracks, isArtist ? SRC.fresh : SRC.mood)
    if (!isArtist) v.tracks.forEach((t) => moodHits.add(t.id))
  }
  if (!cands.length) { // рекомендации ВК недоступны — свежее у любимых артистов
    const s = await Promise.allSettled(top.slice(0, 4).map((a) => window.api.invoke<{ tracks: Track[] }>('vk:search', a, 0, true)))
    add(s.flatMap((r) => list(r)?.tracks.slice(0, 15) ?? []), SRC.fresh)
  }
  if (mode !== 'new') { // своя музыка: для микса — случайная выборка, чтобы не тянуть одно старьё
    const own = mode === 'fav' ? mine : [...mine].sort(() => cryptoRandom() - 0.5).slice(0, 300)
    add(own, SRC.mine)
  }
  return { cands, source, moodHits, artists: artistLangMap([...mine, ...cands]) }
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
  const now = Date.now()
  const artists = artistLangMap(cands)
  const pool = applyTune(cands.filter((t) => !queued.has(t.id) && t.duration < 15 * 60), tune, extra, now, size, artists)
  const source = new Map(cands.map((t) => [t.id, extra.has(t.id) ? 1 : 2]))
  return pickBatch({ candidates: pool, mine: new Set(likes.map((t) => t.id)), mode, profile, recent: recent(), now, rnd: cryptoRandom, size, boost: (t) => tuneBoost(t, tune, { now, moodHits: extra, source }) })
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
  const pool = await vkPool(profile, tune, mode)
  const queued = new Set(player.getState().queue?.list().map((t) => t.id) ?? [])
  const now = Date.now()
  const cand = applyTune(pool.cands.filter((t) => !queued.has(t.id) && t.duration < 15 * 60), tune, pool.moodHits, now, size, pool.artists)
  return pickBatch({ candidates: cand, mine, mode, profile, recent: recent(), now, rnd: cryptoRandom, size, boost: (t) => tuneBoost(t, tune, { now, moodHits: pool.moodHits, source: pool.source }) })
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
      if (!b.length) {
        const st = await window.api.invoke<{ ok: boolean; message?: string }>('sc:status').catch(() => ({ ok: true } as { ok: boolean; message?: string }))
        throw new Error(!st.ok && st.message ? st.message : kind === 'sc' ? 'SoundCloud сейчас ничего не отдал. Попробуй ещё раз чуть позже' : 'Не получилось собрать Волну')
      }
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
