import { createServer } from 'http'
import { createReadStream, statSync } from 'fs'
import { join, basename } from 'path'

/** Раздаёт dev/fixtures/*.mp3 по http (с поддержкой Range) для VK_MOCK=1. */
export function startMockMedia(dir: string): Promise<string> {
  const srv = createServer((req, res) => {
    const file = join(dir, basename(decodeURIComponent((req.url ?? '').split('?')[0])))
    let size: number
    try { size = statSync(file).size } catch { res.writeHead(404).end(); return }
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
    const start = m && m[1] ? +m[1] : 0
    const end = m && m[2] ? +m[2] : size - 1
    res.writeHead(m ? 206 : 200, { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(m ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}), 'Access-Control-Allow-Origin': '*' })
    createReadStream(file, { start, end }).pipe(res)
  })
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(srv.address() as any).port}`)))
}
