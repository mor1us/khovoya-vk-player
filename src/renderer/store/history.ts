import { create } from 'zustand'
import type { Track } from '../../shared/types'
import { pushHistory, type HistoryEntry } from './historyLogic'

const load = (): HistoryEntry[] => { try { return JSON.parse(localStorage.getItem('history') ?? '[]') } catch { return [] } }

export const useHistory = create<{ items: HistoryEntry[]; add(t: Track): void; clear(): void }>((set, get) => ({
  items: load(),
  add(t) { const items = pushHistory(get().items, t, Date.now()); set({ items }); try { localStorage.setItem('history', JSON.stringify(items)) } catch { /* место кончилось */ } },
  clear() { set({ items: [] }); localStorage.removeItem('history') }
}))
