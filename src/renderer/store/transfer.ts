import type { Track } from '../../shared/types'
import { bestMatch } from '../../shared/match'
import { createPlaylistWith } from './playlists'

export type TransferResult = { found: Track[]; missing: Track[] }

/** Найти в ВК те же треки (по названию, артисту и длине). По 3 запроса за раз, чтобы ВК не ругался. */
export async function findOnVk(tracks: Track[], onProgress?: (done: number, total: number) => void): Promise<TransferResult> {
  const found: (Track | null)[] = new Array(tracks.length).fill(null)
  let next = 0, done = 0
  const worker = async () => {
    while (next < tracks.length) {
      const i = next++
      const t = tracks[i]
      if (t.src !== 'sc') { found[i] = t } // уже из ВК
      else {
        try {
          const r = await window.api.invoke<{ tracks: Track[] }>('vk:search', `${t.artist} ${t.title}`)
          found[i] = bestMatch(t, r.tracks)
        } catch { found[i] = null }
      }
      onProgress?.(++done, tracks.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { found: found.filter((x): x is Track => !!x), missing: tracks.filter((_, i) => !found[i]) }
}

/** Перенести плейлист (SoundCloud или Хвои) в ВК: создаётся обычный плейлист ВК из найденных треков. */
export async function transferToVk(title: string, tracks: Track[], onProgress?: (done: number, total: number) => void): Promise<TransferResult & { ok: boolean }> {
  const r = await findOnVk(tracks, onProgress)
  if (!r.found.length) return { ...r, ok: false }
  const p = await createPlaylistWith(title, r.found)
  return { ...r, ok: !!p }
}
