import { describe, it, expect, vi } from 'vitest'
import { VkClient, VkError, VK_UA } from '../src/main/vk/client'

type Call = { url: string; body: URLSearchParams; headers: Record<string, string> }
function fakeFetch(responses: unknown[]) {
  const calls: Call[] = []
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(init.body as string), headers: init.headers as Record<string, string> })
    const r = responses.shift()
    return { ok: true, json: async () => r } as Response
  })
  return { fn: fn as unknown as typeof fetch, calls }
}
const base = (f: typeof fetch, extra: Partial<ConstructorParameters<typeof VkClient>[0]> = {}) =>
  new VkClient({ token: async () => 'TOK', fetch: f, onAuthLost: () => {}, onCaptcha: async () => 'x', sleep: async () => {}, ...extra })

describe('VkClient', () => {
  it('POSTs to api.vk.com with token, version and Kate UA', async () => {
    const { fn, calls } = fakeFetch([{ response: { count: 0, items: [] } }])
    const res = await base(fn).call('audio.get', { count: 10 })
    expect(res).toEqual({ count: 0, items: [] })
    expect(calls[0].url).toBe('https://api.vk.com/method/audio.get')
    expect(calls[0].body.get('access_token')).toBe('TOK')
    expect(calls[0].body.get('v')).toBe('5.131')
    expect(calls[0].body.get('count')).toBe('10')
    expect(calls[0].headers['User-Agent']).toBe(VK_UA)
    expect(calls[0].headers['X-VK-Android-Client']).toBe('new')
  })
  it('retries error 6 up to 3 attempts then throws VkError(6)', async () => {
    const err6 = { error: { error_code: 6, error_msg: 'Too many' } }
    const { fn, calls } = fakeFetch([err6, err6, err6])
    await expect(base(fn).call('audio.get', {})).rejects.toMatchObject({ code: 6 })
    expect(calls.length).toBe(3)
  })
  it('succeeds after one error 6', async () => {
    const { fn, calls } = fakeFetch([{ error: { error_code: 6 } }, { response: 1 }])
    expect(await base(fn).call('x', {})).toBe(1)
    expect(calls.length).toBe(2)
  })
  it('error 5 once → fresh token and retry succeeds', async () => {
    const refresh = vi.fn()
    const { fn, calls } = fakeFetch([{ error: { error_code: 5 } }, { response: 'ok' }])
    expect(await base(fn, { onTokenRejected: refresh }).call('x', {})).toBe('ok')
    expect(refresh).toHaveBeenCalledOnce(); expect(calls.length).toBe(2)
  })
  it('error 5 twice calls onAuthLost and throws', async () => {
    const lost = vi.fn()
    const { fn } = fakeFetch([{ error: { error_code: 5 } }, { error: { error_code: 5 } }])
    const e = (await base(fn, { onAuthLost: lost }).call("x", {}).catch((x: unknown) => x)) as VkError
    expect(e).toBeInstanceOf(VkError)
    expect(e.code).toBe(5)
    expect(lost).toHaveBeenCalledOnce()
  })
  it('error 14 asks captcha and retries with sid/key', async () => {
    const onCaptcha = vi.fn(async () => 'abcd')
    const { fn, calls } = fakeFetch([{ error: { error_code: 14, captcha_sid: '77', captcha_img: 'https://img' } }, { response: 'ok' }])
    expect(await base(fn, { onCaptcha }).call('x', {})).toBe('ok')
    expect(onCaptcha).toHaveBeenCalledWith('77', 'https://img')
    expect(calls[1].body.get('captcha_sid')).toBe('77')
    expect(calls[1].body.get('captcha_key')).toBe('abcd')
  })
  it('no token → VkError(5) without network', async () => {
    const { fn, calls } = fakeFetch([])
    await expect(base(fn, { token: async () => null }).call('x', {})).rejects.toMatchObject({ code: 5 })
    expect(calls.length).toBe(0)
  })
})
