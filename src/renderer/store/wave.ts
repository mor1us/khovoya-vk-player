import { create } from 'zustand'
import type { Track, WaveMode, WaveProfile } from '../../shared/types'
import { applyReaction, emptyProfile, reactionFor, seedsFor, type Reaction } from '../wave/profile'
import { pickBatch } from '../wave/picker'
import { cryptoRandom } from '../player/shuffle'
import { useLibrary } from './library'
import { player } from './playerInstance'

type Wave = {
  mode: WaveMode
  profile: WaveProfile
  loading: boolean
  setMode(m: WaveMode): void
  load(): Promise<void>
  start(mode?: WaveMode): Promise<void>
  react(t: Track, r: Reaction): void
  like(t: Track): Promise<void>
  dislike(t: Track): Promise<void>
}

const recent = (): string[] => { try { return JSON.parse(localStorage.getItem('recent') ?? '[]') } catch { return [] } }
const isWave = () => player.getState().source.startsWith('wave:')
let fetching = false

async function candidates(profile: WaveProfile): Promise<Track[]> {
  const seeds = seedsFor(profile, cryptoRandom)
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

async function batch(mode: WaveMode, profile: WaveProfile, size = 20): Promise<Track[]> {
  const mine = new Set(useLibrary.getState().mine.map((t) => t.id))
  const cand = await candidates(profile)
  const queued = new Set(player.getState().queue?.list().map((t) => t.id) ?? [])
  return pickBatch({ candidates: cand.filter((t) => !queued.has(t.id)), mine, mode, profile, recent: recent(), now: Date.now(), rnd: cryptoRandom, size })
}

export const useWave = create<Wave>((set, get) => ({
  mode: (localStorage.getItem('waveMode') as WaveMode) || 'mix',
  profile: emptyProfile(),
  loading: false,
  setMode(m) { localStorage.setItem('waveMode', m); set({ mode: m }) },
  async load() { try { set({ profile: (await window.api.invoke<WaveProfile | null>('wave:get')) ?? emptyProfile() }) } catch { /* пустой профиль */ } },
  async start(mode) {
    const m = mode ?? get().mode
    if (mode) get().setMode(mode)
    set({ loading: true })
    try {
      const b = await batch(m, get().profile)
      if (b.length) await player.getState().playList(b, b[0].id, `wave:${m}`)
    } finally { set({ loading: false }) }
  },
  react(t, r) {
    const profile = applyReaction(get().profile, t, r, Date.now())
    set({ profile })
    void window.api.invoke('wave:set', profile).catch(() => {})
  },
  async like(t) {
    get().react(t, 'like')
    if (!useLibrary.getState().isMine(t.id)) {
      await window.api.invoke('vk:add', t)
      useLibrary.getState().setMine([t, ...useLibrary.getState().mine])
    }
  },
  async dislike(t) {
    get().react(t, 'dislike')
    if (player.getState().current?.id === t.id) await player.getState().next()
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
        const mode = player.getState().source.slice(5) as WaveMode
        const b = await batch(mode, useWave.getState().profile)
        if (b.length) player.getState().append(b)
      } finally { fetching = false }
    }
  }
}

/** Подборка по вкусу Волны (для миксов «Для вас»). */
export function waveBatch(mode: WaveMode, size: number): Promise<Track[]> { return batch(mode, useWave.getState().profile, size) }
