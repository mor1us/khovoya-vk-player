import { create } from 'zustand'
import type { Track } from '../../shared/types'
import { forgottenFavs } from '../wave/mixes'
import { cryptoRandom } from '../player/shuffle'
import { waveBatch } from './wave'
import { useLibrary } from './library'
import { useUi } from './ui'
import { readJson, writeJson } from './json'

export type Mix = { key: 'fresh' | 'fav'; title: string; sub: string; tracks: Track[] }
type S = { mixes: Mix[]; at: number; busy: boolean; generate(): Promise<void>; ensure(): Promise<void> }

const strip = (ts: Track[]) => ts.map((t) => ({ ...t, url: '' }))
const saved = (): { mixes: Mix[]; at: number } => readJson('mixes', { mixes: [] as Mix[], at: 0 })
const recent = (): string[] => readJson<string[]>('recent', [])

export const useMixes = create<S>((set, get) => ({
  ...saved(), busy: false,
  async ensure() { if (!get().mixes.length || Date.now() - get().at > 24 * 3600_000) await get().generate() },
  async generate() {
    if (get().busy) return
    set({ busy: true })
    try {
      const mine = await useLibrary.getState().loadMine()
      const fresh = await waveBatch('new', 30).catch(() => [] as Track[])
      const fav = forgottenFavs(mine, recent(), 30, cryptoRandom)
      const mixes: Mix[] = [
        ...(fresh.length ? [{ key: 'fresh' as const, title: 'Свежий микс', sub: 'новое по твоему вкусу', tracks: strip(fresh) }] : []),
        ...(fav.length ? [{ key: 'fav' as const, title: 'Забытое любимое', sub: 'давно не слушал', tracks: strip(fav) }] : [])
      ]
      const at = Date.now()
      set({ mixes, at })
      writeJson('mixes', { mixes, at })
    } catch (e) { useUi.getState().toast((e as Error).message) } finally { set({ busy: false }) }
  }
}))
