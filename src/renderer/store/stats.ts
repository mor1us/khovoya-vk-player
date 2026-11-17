import { create } from 'zustand'
import { readJson, writeJson } from './json'
import { bump, fromHistory, statOf, trim, type Stats, type TrackStat } from './statsLogic'
import type { HistoryEntry } from './historyLogic'

const KEY = 'trackStats'

/**
 * Первый запуск: счётчиков ещё нет, зато есть история прослушиваний — переносим её,
 * чтобы сведения о треках не начинались с нуля.
 */
function load(): Stats {
  const saved = readJson<Stats | null>(KEY, null)
  if (saved) return saved
  const moved = fromHistory(readJson<HistoryEntry[]>('history', []))
  writeJson(KEY, moved)
  return moved
}

type StatsStore = {
  items: Stats
  /** Трек включили. */
  played(id: string): void
  /** Трек попал в пачку Волны. */
  fromWave(ids: string[]): void
  /** Дослушал или переключил — видно, что заходит, а что нет. */
  reacted(id: string, kind: 'done' | 'skip'): void
  of(id: string): TrackStat
  clear(): void
}

export const useStats = create<StatsStore>((set, get) => {
  const save = (items: Stats) => { const t = trim(items); set({ items: t }); writeJson(KEY, t) }
  return {
    items: load(),
    played(id) { save(bump(get().items, id, Date.now(), { plays: 1 })) },
    fromWave(ids) {
      const at = Date.now()
      let items = get().items
      for (const id of ids) items = bump(items, id, at, { wave: 1 })
      save(items)
    },
    reacted(id, kind) { save(bump(get().items, id, Date.now(), { [kind]: 1 })) },
    of(id) { return statOf(get().items, id) },
    clear() { set({ items: {} }); writeJson(KEY, {}) }
  }
})
