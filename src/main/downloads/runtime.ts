import { app, protocol, net } from 'electron'
import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { pathToFileURL } from 'url'
import ffmpegPath from 'ffmpeg-static'
import { VK_UA } from '../vk/client'
import { DownloadManager } from './manager'
import { jsonFile } from '../system/jsonFile'
import type { Track } from '../../shared/types'

export const MEDIA_SCHEME = 'khvoya-media'

/** Должно вызываться до app.ready. */
export function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }])
}

function ffmpegBin(): string {
  return String(ffmpegPath).replace('app.asar', 'app.asar.unpacked')
}

function runFfmpeg(args: string[], onProgress: (sec: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const full = ['-user_agent', VK_UA, ...args]
    const p = spawn(ffmpegBin(), full, { windowsHide: true })
    let err = ''
    p.stdout.on('data', (b: Buffer) => { const m = /out_time_us=(\d+)/.exec(b.toString()); if (m) onProgress(+m[1] / 1e6) })
    p.stderr.on('data', (b: Buffer) => { err = (err + b.toString()).slice(-800) })
    signal?.addEventListener('abort', () => p.kill())
    p.on('error', (e) => reject(e))
    p.on('close', (code) => {
      if (signal?.aborted) { try { unlinkSync(args[args.length - 1]) } catch { /* нет файла */ } return reject(new Error('Отменено')) }
      code === 0 ? resolve() : reject(new Error(err.includes('403') || err.includes('404') ? 'Ссылка устарела — попробуй ещё раз' : 'Не удалось скачать трек'))
    })
  })
}

async function fetchCover(url: string): Promise<string | undefined> {
  const r = await fetch(url)
  if (!r.ok) return undefined
  const file = join(app.getPath('temp'), `khvoya-cover-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  setTimeout(() => { try { unlinkSync(file) } catch { /* уже удалён */ } }, 120_000)
  return file
}

export function createDownloads(dir: () => string, onChange: () => void, resolveUrl?: (t: Track) => Promise<string>) {
  const idx = jsonFile<Record<string, string>>('downloads.json', () => ({}))
  const ensureDir = () => { const d = dir(); if (!existsSync(d)) mkdirSync(d, { recursive: true }); return d }
  const m = new DownloadManager({
    dir: ensureDir, runFfmpeg, fetchCover, exists: existsSync,
    loadIndex: idx.read, saveIndex: idx.write, onChange, resolveUrl, sep: process.platform === 'win32' ? '\\' : '/'
  })
  // khvoya-media://local/<id> → скачанный файл (только из индекса загрузок)
  protocol.handle(MEDIA_SCHEME, (req) => {
    const id = decodeURIComponent(new URL(req.url).pathname.slice(1))
    const p = m.localPath(id)
    if (!p) return new Response('not found', { status: 404 })
    return net.fetch(pathToFileURL(p).toString(), { headers: req.headers }).then((r) => {
      const h = new Headers(r.headers); h.set('Access-Control-Allow-Origin', '*'); h.set('Content-Type', 'audio/mpeg')
      return new Response(r.body, { status: r.status, headers: h })
    })
  })
  return m
}
