import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Track } from '../../shared/types'
import { Queue, type Repeat, type QueueJSON } from '../player/queue'
import { fadePlan, withUrlRefresh } from '../player/crossfade'
import { parseJson } from './json'

export type EngineLike = {
  load(url: string, startAt?: number): Promise<void>
  play(): Promise<void>
  pause(): void
  seek(s: number): void
  setVolume(v: number): void
  crossfadeTo(url: string, len: number): Promise<void>
  onTimeUpdate(cb: (t: number, d: number) => void): void
  onEnded(cb: () => void): void
  onError(cb: (e: unknown) => void): void
}

export type PlayerDeps = {
  engine: EngineLike
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void }
  resolveUrl: (t: Track) => Promise<string>
  refreshUrl: (t: Track) => Promise<string>
  crossfadeSec: () => number
  onNotice?: (msg: string) => void
  /** Смена трека: prev — что играло, listened — сколько секунд его слушали, manual — переключил сам. */
  onTrackChange?: (prev: Track | null, next: Track | null, info: { listened: number; manual: boolean }) => void
  onQueueLow?: (remaining: number) => void
}

export type PlayerState = {
  queue: Queue | null
  current: Track | null
  playing: boolean
  position: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: Repeat
  source: string
  rev: number
  playList(tracks: Track[], startId: string | undefined, source: string): Promise<void>
  toggle(): Promise<void>
  pause(): void
  next(): Promise<void>
  prev(): Promise<void>
  seek(s: number): void
  setVolume(v: number): void
  toggleShuffle(): void
  cycleRepeat(): void
  append(tracks: Track[]): void
  jump(id: string): Promise<void>
  persist(): void
  restore(): void
}

const RECENT_MAX = 200
const MAX_SKIPS = 3

export function createPlayer(d: PlayerDeps): StoreApi<PlayerState> {
  let loadedId: string | null = null // какой трек реально загружен в движок
  let fadeStartedFor: string | null = null
  let busy = false

  const recent = (): string[] => parseJson<string[]>(d.storage.getItem('recent'), [])
  const pushRecent = (id: string) => d.storage.setItem('recent', JSON.stringify([id, ...recent().filter((x) => x !== id)].slice(0, RECENT_MAX)))

  const store = createStore<PlayerState>()((set, get) => {
    /** Запустить трек: manual — 0,3 с, auto — кроссфейд по настройке, first — без перехода. */
    async function start(target: Track | null, mode: 'first' | 'manual' | 'auto', startAt = 0, prevListened = get().position, skipped = 0): Promise<void> {
      const prev = get().current
      if (!target) { d.engine.pause(); set({ playing: false }); return }
      const plan = fadePlan({ duration: prev?.duration ?? 0, crossfadeSec: d.crossfadeSec(), repeat: get().repeat, manual: mode === 'manual' })
      const fade = mode !== 'first' && loadedId !== null && get().playing && (mode === 'manual' || plan.startAt !== null)
      const load = async (u: string) => {
        if (fade) await d.engine.crossfadeTo(u, plan.length)
        else { await d.engine.load(u, startAt); await d.engine.play() }
      }
      const res = await withUrlRefresh(await d.resolveUrl(target), load, () => d.refreshUrl(target))
      if (res === 'skip') {
        if (skipped + 1 >= MAX_SKIPS) {
          d.engine.pause()
          set({ playing: false, current: target })
          d.onNotice?.('Не получается включить треки. Проверь интернет или войди в ВК заново.')
          return
        }
        d.onNotice?.(`«${target.title}» сейчас недоступен — пропускаю`)
        const q = get().queue
        if (!q) return
        const after = q.next(false)
        if (after && after.id !== target.id) return start(after, mode === 'first' ? 'first' : mode, 0, prevListened, skipped + 1)
        set({ playing: false }); return
      }
      loadedId = target.id
      fadeStartedFor = null
      pushRecent(target.id)
      set({ current: target, playing: true, position: startAt, duration: target.duration, rev: get().rev + 1 })
      if (prev?.id !== target.id || mode !== 'first') d.onTrackChange?.(prev ?? null, target, { listened: prevListened, manual: mode !== 'auto' })
      const q = get().queue
      if (q) d.onQueueLow?.(q.remaining())
    }

    d.engine.onTimeUpdate((t, dur) => {
      const s = get()
      set({ position: t, duration: dur || s.duration })
      const cur = s.current
      if (!cur || !s.playing || busy) return
      const plan = fadePlan({ duration: dur || cur.duration, crossfadeSec: d.crossfadeSec(), repeat: s.repeat, manual: false })
      if (plan.startAt !== null && t >= plan.startAt && fadeStartedFor !== cur.id) {
        const nxt = s.queue?.peekNext()
        if (!nxt) return
        fadeStartedFor = cur.id
        busy = true
        s.queue!.next(true)
        void start(nxt, 'auto', 0, t).finally(() => { busy = false })
      }
    })
    d.engine.onEnded(() => {
      const s = get()
      if (busy) return
      if (s.repeat === 'one' && s.current) { d.engine.seek(0); void d.engine.play(); return }
      const nxt = s.queue?.next(true) ?? null
      if (!nxt) { set({ playing: false }); return }
      loadedId = null // переход без кроссфейда
      busy = true
      void start(nxt, 'first', 0, s.position).finally(() => { busy = false })
    })
    /** Обрыв посреди трека: один перезапрос ссылки и продолжение с того же места, иначе — следующий трек. */
    d.engine.onError(async () => {
      const s = get()
      const cur = s.current
      if (!cur || busy || loadedId !== cur.id) return
      busy = true
      const at = s.position
      try {
        let fresh = ''
        try { fresh = await d.refreshUrl(cur) } catch { fresh = '' }
        if (fresh) {
          try { await d.engine.load(fresh, at); if (get().playing) await d.engine.play(); return } catch { /* не вышло — пропускаем */ }
        }
        d.onNotice?.(`«${cur.title}» оборвался — включаю следующий`)
        const nxt = s.queue?.next(false) ?? null
        loadedId = null
        await start(nxt, 'first', 0, at)
      } finally { busy = false }
    })

    return {
      queue: null, current: null, playing: false, position: 0, duration: 0, volume: 0.8,
      shuffle: false, repeat: 'off', source: '', rev: 0,

      async playList(tracks, startId, source) {
        const i = Math.max(0, startId ? tracks.findIndex((t) => t.id === startId) : 0)
        const q = new Queue(tracks, i, source)
        q.repeat = get().repeat
        if (get().shuffle) q.setShuffle(true, recent())
        const prevPlaying = get().playing
        set({ queue: q, source, rev: get().rev + 1 })
        await start(q.current(), prevPlaying && loadedId ? 'manual' : 'first')
      },

      async toggle() {
        const s = get()
        if (!s.current) return
        if (s.playing) { d.engine.pause(); set({ playing: false }); return }
        if (loadedId !== s.current.id) { await start(s.current, 'first', s.position); return }
        await d.engine.play(); set({ playing: true })
      },

      pause() { d.engine.pause(); set({ playing: false }) },

      async next() {
        const s = get(); if (!s.queue || busy) return
        busy = true
        try { const n = s.queue.next(false); await start(n, s.playing ? 'manual' : 'first') } finally { busy = false }
      },

      async prev() {
        const s = get(); if (!s.queue || busy) return
        if (s.position > 5) { d.engine.seek(0); set({ position: 0 }); return }
        busy = true
        try { const p = s.queue.prev(); await start(p, s.playing ? 'manual' : 'first') } finally { busy = false }
      },

      async jump(id) {
        const s = get(); if (!s.queue) return
        s.queue.jumpTo(id)
        await start(s.queue.current(), s.playing ? 'manual' : 'first')
      },

      seek(sec) { d.engine.seek(sec); set({ position: sec }); fadeStartedFor = null },
      setVolume(v) { const x = Math.max(0, Math.min(1, v)); d.engine.setVolume(x); set({ volume: x }) },
      toggleShuffle() { const on = !get().shuffle; get().queue?.setShuffle(on, recent()); set({ shuffle: on, rev: get().rev + 1 }) },
      cycleRepeat() {
        const r: Repeat = get().repeat === 'off' ? 'all' : get().repeat === 'all' ? 'one' : 'off'
        const q = get().queue; if (q) q.repeat = r
        set({ repeat: r })
      },
      append(tracks) { get().queue?.append(tracks); set({ rev: get().rev + 1 }) },

      persist() {
        const s = get()
        if (!s.queue) return
        d.storage.setItem('player', JSON.stringify({ queue: s.queue.toJSON(), position: s.position, volume: s.volume, shuffle: s.shuffle, repeat: s.repeat }))
      },
      restore() {
        type Saved = { queue: QueueJSON; position: number; volume: number; shuffle: boolean; repeat: Repeat }
        const j = parseJson<Saved | null>(d.storage.getItem('player'), null)
        if (!j?.queue) return
        const q = Queue.fromJSON(j.queue)
        d.engine.setVolume(j.volume ?? 0.8)
        set({ queue: q, current: q.current(), playing: false, position: j.position ?? 0, duration: q.current()?.duration ?? 0,
          volume: j.volume ?? 0.8, shuffle: !!j.shuffle, repeat: j.repeat ?? 'off', source: q.source, rev: get().rev + 1 })
      }
    }
  })
  return store
}
