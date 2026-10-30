import type { DownloadJob, Track } from '../../shared/types'
import { safeFileName, uniqueName } from './filename'

const PARALLEL = 2

export function ffmpegArgs(o: { url: string; cover?: string; artist: string; title: string; out: string }): string[] {
  const isMp3 = /\.mp3(\?|$)/i.test(o.url)
  const a = ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-i', o.url]
  if (o.cover) a.push('-i', o.cover)
  a.push('-map', '0:a')
  if (o.cover) a.push('-map', '1:v', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)')
  a.push('-c:a', ...(isMp3 ? ['copy'] : ['libmp3lame', '-b:a', '320k']))
  a.push('-id3v2_version', '3', '-metadata', `artist=${o.artist}`, '-metadata', `title=${o.title}`, o.out)
  return a
}

type Deps = {
  dir: () => string
  /** onProgress получает секунды, уже обработанные ffmpeg. */
  runFfmpeg: (args: string[], onProgress: (sec: number) => void, signal?: AbortSignal) => Promise<void>
  fetchCover: (url: string) => Promise<string | undefined>
  exists: (path: string) => boolean
  loadIndex: () => Record<string, string>
  saveIndex: (x: Record<string, string>) => void
  onChange: () => void
  sep?: string
}

type Job = DownloadJob & { track: Track; abort?: AbortController }

export class DownloadManager {
  private jobs: Job[] = []
  private index: Record<string, string>
  private active = 0
  private reserved = new Set<string>()

  constructor(private d: Deps) { this.index = d.loadIndex() }

  list(): DownloadJob[] {
    const live = this.jobs.map(({ track: _t, abort: _a, ...j }) => j)
    const ids = new Set(live.map((j) => j.id))
    const past = Object.entries(this.index).filter(([id, p]) => !ids.has(id) && this.d.exists(p)).map(([id, p]) => {
      const name = p.split(/[\\/]/).pop()!.replace(/\.mp3$/i, '')
      const [artist, ...rest] = name.split(' - ')
      return { id, artist, title: rest.join(' - ') || name, status: 'done' as const, progress: 1, path: p }
    })
    return [...live, ...past]
  }

  localPath(id: string): string | null {
    const p = this.index[id]
    return p && this.d.exists(p) ? p : null
  }

  enqueue(tracks: Track[]) {
    for (const t of tracks) {
      if (!t.available) continue
      if (this.jobs.some((j) => j.id === t.id && (j.status === 'queued' || j.status === 'active'))) continue
      if (this.localPath(t.id)) continue
      this.jobs = this.jobs.filter((j) => j.id !== t.id)
      this.jobs.push({ id: t.id, title: t.title, artist: t.artist, status: 'queued', progress: 0, track: t })
    }
    this.d.onChange()
    this.pump()
  }

  cancel(id: string) {
    const j = this.jobs.find((x) => x.id === id)
    if (!j) return
    if (j.status === 'active') j.abort?.abort()
    if (j.status === 'queued' || j.status === 'active') j.status = 'canceled'
    this.d.onChange()
  }

  clearFinished() { this.jobs = this.jobs.filter((j) => j.status === 'queued' || j.status === 'active'); this.d.onChange() }

  private pump() {
    while (this.active < PARALLEL) {
      const j = this.jobs.find((x) => x.status === 'queued')
      if (!j) return
      void this.run(j)
    }
  }

  private async run(j: Job) {
    this.active++
    j.status = 'active'
    j.abort = new AbortController()
    const sep = this.d.sep ?? '/'
    const dir = this.d.dir()
    const name = uniqueName(safeFileName(j.artist, j.title), (n) => this.reserved.has(dir + sep + n) || this.d.exists(dir + sep + n))
    const out = dir + sep + name
    this.reserved.add(out)
    this.d.onChange()
    try {
      const cover = j.track.coverUrl && /^https:/.test(j.track.coverUrl) ? await this.d.fetchCover(j.track.coverUrl).catch(() => undefined) : undefined
      await this.d.runFfmpeg(ffmpegArgs({ url: j.track.url, cover, artist: j.artist, title: j.title, out }), (sec) => {
        j.progress = j.track.duration > 0 ? Math.max(0, Math.min(0.99, sec / j.track.duration)) : 0
        this.d.onChange()
      }, j.abort.signal)
      if ((j.status as DownloadJob['status']) === 'canceled') return
      j.status = 'done'; j.progress = 1; j.path = out
      this.index = { ...this.index, [j.id]: out }
      this.d.saveIndex(this.index)
    } catch (e) {
      if ((j.status as DownloadJob['status']) !== 'canceled') { j.status = 'error'; j.error = (e as Error).message || 'Не удалось скачать' }
    } finally {
      this.reserved.delete(out)
      this.active--
      this.d.onChange()
      this.pump()
    }
  }
}
