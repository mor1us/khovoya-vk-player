import { describe, it, expect, vi } from 'vitest'
import { DownloadManager, ffmpegArgs } from '../src/main/downloads/manager'
import type { Track } from '../src/shared/types'

const tr = (i: number, url = 'https://cs/' + i + '.mp3'): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist: 'A', duration: 100, url, available: true, coverUrl: i % 2 ? 'https://img/' + i : undefined })

function setup(files = new Set<string>()) {
  const runs: { args: string[]; resolve: () => void; reject: (e: Error) => void; progress: (f: number) => void }[] = []
  const index = new Map<string, string>()
  const m = new DownloadManager({
    dir: () => '/music',
    runFfmpeg: (args, onProgress) => new Promise<void>((resolve, reject) => { runs.push({ args, resolve: () => { files.add(args[args.length - 1]); resolve() }, reject, progress: onProgress }) }),
    fetchCover: async () => '/tmp/c.jpg',
    exists: (p) => files.has(p),
    loadIndex: () => Object.fromEntries(index),
    saveIndex: (x) => { index.clear(); for (const [k, v] of Object.entries(x)) index.set(k, v) },
    onChange: vi.fn()
  })
  return { m, runs, files, index }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('DownloadManager', () => {
  it('runs at most 2 at once', async () => {
    const { m, runs } = setup()
    m.enqueue([tr(1), tr(2), tr(3), tr(4)]); await tick()
    expect(runs.length).toBe(2)
    expect(m.list().filter((j) => j.status === 'active').length).toBe(2)
    runs[0].resolve(); await tick(); await tick()
    expect(runs.length).toBe(3)
  })
  it('records done jobs in index and localPath', async () => {
    const { m, runs, index } = setup()
    m.enqueue([tr(1)]); await tick()
    runs[0].resolve(); await tick(); await tick()
    expect(m.list()[0].status).toBe('done')
    expect(m.localPath('t1')).toBe('/music/A - T1.mp3')
    expect(index.get('t1')).toBe('/music/A - T1.mp3')
  })
  it('localPath is null when the file was deleted', async () => {
    const { m, runs, files } = setup()
    m.enqueue([tr(1)]); await tick(); runs[0].resolve(); await tick(); await tick()
    files.clear()
    expect(m.localPath('t1')).toBeNull()
  })
  it('does not enqueue the same track twice', async () => {
    const { m, runs } = setup()
    m.enqueue([tr(1), tr(1)]); m.enqueue([tr(1)]); await tick()
    expect(runs.length).toBe(1); expect(m.list().length).toBe(1)
  })
  it('error marks job and continues with next', async () => {
    const { m, runs } = setup()
    m.enqueue([tr(1), tr(2), tr(3)]); await tick()
    runs.find((r) => r.args.at(-1)!.includes('T1'))!.reject(new Error('boom')); await tick(); await tick()
    expect(m.list().find((j) => j.id === 't1')?.status).toBe('error')
    expect(runs.length).toBe(3)
  })
  it('cancel queued job', async () => {
    const { m } = setup()
    m.enqueue([tr(1), tr(2), tr(3)]); await tick()
    m.cancel('t3')
    expect(m.list().find((j) => j.id === 't3')?.status).toBe('canceled')
  })
  it('unique file names for same artist/title', async () => {
    const { m, runs } = setup(new Set(['/music/A - T1.mp3']))
    m.enqueue([tr(1)]); await tick()
    expect(runs[0].args.at(-1)).toBe('/music/A - T1 (2).mp3')
  })
})

describe('ffmpegArgs', () => {
  it('hls with cover → libmp3lame 320k, id3 tags, cover stream', () => {
    const a = ffmpegArgs({ url: 'https://x/index.m3u8', cover: '/c.jpg', artist: 'Дворы', title: 'Кислота', out: '/o.mp3' })
    expect(a).toContain('libmp3lame'); expect(a).toContain('320k')
    expect(a).toContain('artist=Дворы'); expect(a).toContain('title=Кислота')
    expect(a.filter((x) => x === '-i').length).toBe(2)
    expect(a.at(-1)).toBe('/o.mp3')
  })
  it('mp3 source → copy codec; no cover → one input', () => {
    const a = ffmpegArgs({ url: 'https://x/a.mp3?extra=1', artist: 'A', title: 'B', out: '/o.mp3' })
    expect(a).toContain('copy'); expect(a).not.toContain('libmp3lame')
    expect(a.filter((x) => x === '-i').length).toBe(1)
  })
})
