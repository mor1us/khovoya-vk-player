import { VK_UA } from '../vk/client'

export async function fetchImageDataUrl(f: typeof fetch, url: string): Promise<string> {
  const r = await f(url, { headers: { 'User-Agent': VK_UA } })
  const type = r.headers.get('content-type') || 'image/jpeg'
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
  return `data:${type.startsWith('image/') ? type : 'image/jpeg'};base64,${b64}`
}
