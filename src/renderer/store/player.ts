import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Track } from '../../shared/types'
import { Queue, type Repeat, type QueueJSON } from '../player/queue'
import { fadePlan, withUrlRefresh } from '../player/crossfade'
import { parseJson } from './json'
import { trackKey } from '../../shared/match'

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
  fallbackUrl?: (t: Track) => Promise<string>
  crossfadeSec: () => number
  onNotice?: (msg: string) => void
  onPlaybackError?: (t: Track, stage: 'load' | 'resolve' | 'playing', error?: unknown) => void
  /** Смена трека: listened — реально прошедшее время воспроизведения; seek делает сигнал ненадёжным. */
  onTrackChange?: (prev: Track | null, next: Track | null, info: { listened: number; manual: boolean; broken?: boolean; sought?: boolean; completed?: boolean }) => void
  onQueueLow?: (remaining: number) => void
}

export type PlayerState = {
  queue: Queue | null
  current: Track | null
  playing: boolean
  loading: boolean
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
  removeOtherCopies(track: Track): void
  jump(id: string): Promise<void>
  persist(): void
  restore(): void
}

const RECENT_MAX = 200

export function createPlayer(d: PlayerDeps): StoreApi<PlayerState> {
  let loadedId: string | null = null // какой трек реально загружен в движок
  let fadeStartedFor: string | null = null
  let pending = Promise.resolve()
  let busy = 0
  let signalTrackId: string | null = null
  let signalPosition = 0
  let listenedSeconds = 0
  let signalStarted = false
  let signalSought = false

  function run(task: () => Promise<void>) {
    busy++
    const result = pending.then(task).finally(() => { busy-- })
    pending = result.catch(() => {})
    return result
  }

  const recent = (): string[] => parseJson<string[]>(d.storage.getItem('recent'), [])
  const recentKeys = (): string[] => parseJson<string[]>(d.storage.getItem('recentKeys'), [])
  /** Кроме id храним ключ «артист — название»: Волна должна узнавать ту же песню в другой копии ВК. */
  const pushRecent = (t: Track) => {
    d.storage.setItem('recent', JSON.stringify([t.id, ...recent().filter((x) => x !== t.id)].slice(0, RECENT_MAX)))
    const k = trackKey(t)
    d.storage.setItem('recentKeys', JSON.stringify([k, ...recentKeys().filter((x) => x !== k)].slice(0, RECENT_MAX)))
  }

  const store = createStore<PlayerState>()((set, get) => {
    /** Запустить трек: manual — выбор пользователя, auto — кроссфейд, first — обычное окончание. */
    async function start(target: Track | null, mode: 'first' | 'manual' | 'auto', startAt = 0, completed = false): Promise<void> {
      const prev = get().current
      if (!target) { d.engine.pause(); set({ playing: false }); return }
      const plan = fadePlan({ duration: prev?.duration ?? 0, crossfadeSec: d.crossfadeSec(), repeat: get().repeat, manual: mode === 'manual' })
      const fade = mode !== 'first' && loadedId !== null && get().playing && (mode === 'manual' || plan.startAt !== null)
      const load = async (u: string) => {
        try {
          if (fade) await d.engine.crossfadeTo(u, plan.length)
          else { loadedId = null; await d.engine.load(u, startAt); await d.engine.play() }
        } catch (error) {
          d.onPlaybackError?.(target, 'load', error)
          throw error
        }
      }
      const fallback = d.fallbackUrl
      set({ loading: true })
      const res = await withUrlRefresh(await d.resolveUrl(target).catch(() => ''), load, () => d.refreshUrl(target), fallback && (() => fallback(target)))
        .finally(() => set({ loading: false }))
      if (res === 'skip') {
        d.onPlaybackError?.(target, 'resolve')
        d.engine.pause()
        loadedId = null
        fadeStartedFor = null
        set({ current: target, playing: false, position: startAt, duration: target.duration, rev: get().rev + 1 })
        d.onNotice?.(`«${target.title}» не удалось загрузить. Нажми «Играть», чтобы повторить.`)
        return
      }
      loadedId = target.id
      fadeStartedFor = null
      pushRecent(target)
      set({ current: target, playing: true, position: startAt, duration: target.duration, rev: get().rev + 1 })
      if (prev?.id !== target.id) {
        if (prev && signalTrackId === prev.id && signalStarted) {
          d.onTrackChange?.(prev, target, { listened: listenedSeconds, manual: mode === 'manual', broken: false, sought: signalSought, completed })
        }
        signalTrackId = target.id
        signalPosition = startAt
        listenedSeconds = 0
        signalStarted = true
        signalSought = false
      } else {
        signalTrackId = target.id
        signalPosition = startAt
        signalStarted = true
      }
      const q = get().queue
      if (q) d.onQueueLow?.(q.remaining())
    }

    d.engine.onTimeUpdate((t, dur) => {
      const s = get()
      if (s.current && signalTrackId === s.current.id) {
        if (s.playing && signalStarted) {
          const delta = t - signalPosition
          if (delta < -0.5) signalSought = true
          else if (delta > 0) listenedSeconds += Math.min(delta, 15)
        }
        signalPosition = t
      }
      set({ position: t, duration: dur || s.duration })
      const cur = s.current
      if (!cur || !s.playing || busy) return
      const plan = fadePlan({ duration: dur || cur.duration, crossfadeSec: d.crossfadeSec(), repeat: s.repeat, manual: false })
      if (plan.startAt !== null && t >= plan.startAt && fadeStartedFor !== cur.id) {
        const nxt = s.queue?.peekNext()
        if (!nxt) return
        fadeStartedFor = cur.id
        s.queue!.next(true)
        void run(() => start(nxt, 'auto'))
      }
    })
    d.engine.onEnded(() => {
      const s = get()
      if (busy) return
      if (s.repeat === 'one' && s.current) {
        const cur = s.current
        if (signalTrackId === cur.id) signalPosition = 0
        void run(async () => {
          try { d.engine.seek(0); await d.engine.play() }
          catch (error) { d.onPlaybackError?.(cur, 'playing', error); await start(cur, 'first') }
        })
        return
      }
      const nxt = s.queue?.next(true) ?? null
      if (!nxt) {
        const cur = s.current
        if (cur && signalTrackId === cur.id && signalStarted) {
          d.onTrackChange?.(cur, null, { listened: listenedSeconds, manual: false, broken: false, sought: signalSought, completed: true })
        }
        set({ playing: false })
        return
      }
      loadedId = null // переход без кроссфейда
      void run(() => start(nxt, 'first', 0, true))
    })
    /** При обрыве оставляем позицию и очередь, чтобы можно было повторить тот же трек. */
    d.engine.onError((error) => {
      const s = get()
      const cur = s.current
      if (!cur || busy || loadedId !== cur.id) return
      d.onPlaybackError?.(cur, 'playing', error)
      const at = s.position
      return run(async () => {
        const fallback = d.fallbackUrl
        set({ loading: true })
        const resumed = await withUrlRefresh('', async (url) => {
          await d.engine.load(url, at)
          if (get().playing) await d.engine.play()
        }, () => d.refreshUrl(cur), fallback && (() => fallback(cur)))
          .finally(() => set({ loading: false }))
        if (resumed === 'ok') { set({ position: at }); return }
        loadedId = null
        d.engine.pause()
        set({ position: at, playing: false })
        d.onNotice?.(`«${cur.title}» оборвался. Нажми «Играть», чтобы повторить.`)
      })
    })

    return {
      queue: null, current: null, playing: false, loading: false, position: 0, duration: 0, volume: 0.8,
      shuffle: false, repeat: 'off', source: '', rev: 0,

      playList: (tracks, startId, source) => run(async () => {
        const i = startId ? tracks.findIndex((t) => t.id === startId) : 0
        if (startId && !tracks[i]?.available) {
          d.onNotice?.('Выбранный трек недоступен')
          return
        }
        const q = new Queue(tracks, i, source)
        q.repeat = get().repeat
        if (get().shuffle) q.setShuffle(true, recent(), recentKeys())
        set({ queue: q, source, rev: get().rev + 1 })
        const old = get().current
        await start(q.current(), old && old.id !== q.current()?.id ? 'manual' : 'first')
      }),

      toggle: () => run(async () => {
        const s = get()
        if (!s.current) return
        if (s.playing) { d.engine.pause(); set({ playing: false }); return }
        if (loadedId !== s.current.id) { await start(s.current, 'first', s.position); return }
        try { await d.engine.play(); set({ playing: true }) }
        catch (error) { d.onPlaybackError?.(s.current, 'playing', error); await start(s.current, 'first', s.position) }
      }),

      pause() {
        const pause = () => { d.engine.pause(); set({ playing: false }) }
        if (busy) void run(async () => pause())
        else pause()
      },

      next: () => run(async () => {
        const s = get(); if (!s.queue) return
        await start(s.queue.next(false), 'manual')
      }),

      prev: () => run(async () => {
        const s = get(); if (!s.queue) return
        if (s.position > 5) { signalSought = true; signalPosition = 0; d.engine.seek(0); set({ position: 0 }); return }
        await start(s.queue.prev(), 'manual')
      }),

      jump: (id) => run(async () => {
        const s = get(); if (!s.queue) return
        if (!s.queue.list().some((t) => t.id === id && t.available)) return
        s.queue.jumpTo(id)
        await start(s.queue.current(), 'manual')
      }),

      seek(sec) { signalSought = true; signalPosition = sec; d.engine.seek(sec); set({ position: sec }); fadeStartedFor = null },
      setVolume(v) { const x = Math.max(0, Math.min(1, v)); d.engine.setVolume(x); set({ volume: x }) },
      toggleShuffle() { const on = !get().shuffle; get().queue?.setShuffle(on, recent(), recentKeys()); set({ shuffle: on, rev: get().rev + 1 }) },
      cycleRepeat() {
        const r: Repeat = get().repeat === 'off' ? 'all' : get().repeat === 'all' ? 'one' : 'off'
        const q = get().queue; if (q) q.repeat = r
        set({ repeat: r })
      },
      append(tracks) { get().queue?.append(tracks); set({ rev: get().rev + 1 }) },
      removeOtherCopies(track) { get().queue?.removeOtherCopies(track); set({ rev: get().rev + 1 }) },

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
