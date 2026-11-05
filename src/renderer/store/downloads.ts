import { create } from 'zustand'
import type { DownloadJob, Track } from '../../shared/types'
import { useUi } from './ui'

type Dl = {
  jobs: DownloadJob[]
  done: Set<string>
  refresh(): Promise<void>
  start(tracks: Track[]): Promise<void>
  cancel(id: string): Promise<void>
}

export const useDownloads = create<Dl>((set) => ({
  jobs: [], done: new Set(),
  async refresh() {
    try {
      const jobs = await window.api.invoke('dl:list')
      set({ jobs, done: new Set(jobs.filter((j) => j.status === 'done').map((j) => j.id)) })
    } catch { /* загрузок пока нет */ }
  },
  async start(tracks) {
    const ok = tracks.filter((t) => t.available)
    if (!ok.length) { useUi.getState().toast('Этот трек недоступен для скачивания'); return }
    await window.api.invoke('dl:start', ok)
    useUi.getState().toast(ok.length === 1 ? `Скачиваю «${ok[0].title}»` : `Скачиваю ${ok.length} треков`)
  },
  async cancel(id) { await window.api.invoke('dl:cancel', id) }
}))

let bound = false
export function bindDownloads() {
  if (bound) return
  bound = true
  void useDownloads.getState().refresh()
  window.api.on('dl:changed', () => void useDownloads.getState().refresh())
}
