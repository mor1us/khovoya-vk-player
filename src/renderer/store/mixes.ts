import { create } from 'zustand'
import type { Track } from '../../shared/types'
import { forgottenFavs } from '../wave/mixes'
import { cryptoRandom } from '../player/shuffle'
import { useLibrary } from './library'
import { useUi } from './ui'
import { readJson, writeJson } from './json'

export type Mix = { key: 'fav'; title: string; sub: string; tracks: Track[] }
type S = { mixes: Mix[]; at: number; busy: boolean; generate(): Promise<void>; ensure(): Promise<void> }

const strip = (ts: Track[]) => ts.map((t) => ({ ...t, url: '' }))
/** Версия отбора: когда алгоритм меняется, вчерашний микс в localStorage надо выбросить, а не показывать сутки. */
const V = 3
const saved = (): { mixes: Mix[]; at: number } => {
  const x = readJson<{ mixes: Mix[]; at: number; v?: number }>('mixes', { mixes: [], at: 0 })
  return x.v === V ? { mixes: x.mixes, at: x.at } : { mixes: [], at: 0 }
}
const recent = (): string[] => readJson<string[]>('recent', [])

export const useMixes = create<S>((set, get) => ({
  ...saved(), busy: false,
  async ensure() { if (!get().mixes.length || Date.now() - get().at > 24 * 3600_000) await get().generate() },
  async generate() {
    if (get().busy) return
    set({ busy: true })
    try {
      const mine = await useLibrary.getState().loadMine()
      const fav = forgottenFavs(mine, recent(), 30, cryptoRandom)
      const mixes: Mix[] = fav.length ? [{ key: 'fav' as const, title: 'Забытое любимое', sub: 'давно не слушал', tracks: strip(fav) }] : []
      const at = Date.now()
      set({ mixes, at })
      writeJson('mixes', { mixes, at, v: V })
    } catch (e) { useUi.getState().toast((e as Error).message) } finally { set({ busy: false }) }
  }
}))
