import { create } from 'zustand'
import type { Track } from '../../shared/types'
import { pushHistory, type HistoryEntry } from './historyLogic'
import { readJson, writeJson } from './json'

const load = (): HistoryEntry[] => readJson<HistoryEntry[]>('history', [])

export const useHistory = create<{ items: HistoryEntry[]; add(t: Track): void; clear(): void }>((set, get) => ({
  items: load(),
  add(t) { const items = pushHistory(get().items, t, Date.now()); set({ items }); writeJson('history', items) },
  clear() { set({ items: [] }); localStorage.removeItem('history') }
}))
