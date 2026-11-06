import { describe, it, expect } from 'vitest'
import { makeVkApi } from '../src/mobile/vkApi'

type Call = { url: string; headers: Record<string, string>; body: string }

/** Подставная сеть: настоящих запросов не делаем, только смотрим, что ушло. */
function net(replies: unknown[]) {
  const calls: Call[] = []
  let i = 0
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: String(init?.body ?? '') })
    const body = replies[Math.min(i++, replies.length - 1)]
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response
  }) as unknown as typeof fetch
  return { f, calls }
}

const TOKEN = { type: 'okay', data: { access_token: 'ключ', user_id: 7, expires: 0 } }
const ok = (response: unknown) => ({ response })

describe('ВК на телефоне', () => {
  it('представляется официальным приложением — иначе audio.* не отдадут', async () => {
    const { f, calls } = net([TOKEN, ok({ items: [] })])
    const { api } = makeVkApi({ fetch: f, onCaptcha: async () => '', onAuthLost: () => {}, log: () => {} })
    await api.myTracks()
    const toApi = calls.find((c) => c.url.includes('api.vk.com'))!
    expect(toApi.headers['User-Agent']).toMatch(/^VKAndroidApp\//)
    expect(toApi.headers['X-VK-Android-Client']).toBe('new')
  })

  it('ключ берётся у страницы ВК по cookie, а не выдумывается', async () => {
    const { f, calls } = net([TOKEN, ok({ items: [] })])
    const { api } = makeVkApi({ fetch: f, onCaptcha: async () => '', onAuthLost: () => {}, log: () => {} })
    await api.myTracks()
    expect(calls[0].url).toContain('login.vk.')
    expect(calls[0].url).toContain('act=web_token')
    expect(calls.find((c) => c.url.includes('api.vk.com'))!.body).toContain('access_token=%D0%BA%D0%BB%D1%8E%D1%87')
  })

  it('за ключом не бегает на каждый запрос', async () => {
    const { f, calls } = net([TOKEN, ok({ items: [] }), ok({ items: [] })])
    const { api } = makeVkApi({ fetch: f, onCaptcha: async () => '', onAuthLost: () => {}, log: () => {} })
    await api.myTracks(); await api.myTracks()
    expect(calls.filter((c) => c.url.includes('act=web_token')).length).toBe(1)
  })

  it('капча уходит наружу, запрос повторяется с ответом', async () => {
    const { f, calls } = net([TOKEN, { error: { error_code: 14, captcha_sid: '77', captcha_img: 'http://x' } }, ok({ items: [] })])
    let asked = ''
    const { api } = makeVkApi({ fetch: f, onCaptcha: async (sid) => { asked = sid; return 'абв' }, onAuthLost: () => {}, log: () => {} })
    await api.myTracks()
    expect(asked).toBe('77')
    expect(calls[calls.length - 1].body).toContain('captcha_sid=77')
  })

  it('сессия кончилась — зовём onAuthLost и говорим это по-русски', async () => {
    const { f } = net([TOKEN, { error: { error_code: 5, error_msg: 'auth' } }])
    let lost = false
    const { api } = makeVkApi({ fetch: f, onCaptcha: async () => '', onAuthLost: () => { lost = true }, log: () => {} })
    await expect(api.myTracks()).rejects.toThrow('Сессия ВК закончилась, войди снова')
    expect(lost).toBe(true)
  })

  it('за ключом ходит с тем же заголовком, что и окно входа', async () => {
    const { f, calls } = net([TOKEN, ok({ items: [] })])
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
    const { api } = makeVkApi({ fetch: f, onCaptcha: async () => '', onAuthLost: () => {}, log: () => {}, webUa: () => ua })
    await api.myTracks()
    const toToken = calls.find((c) => c.url.includes('act=web_token'))!
    expect(toToken.headers['User-Agent']).toBe(ua)
  })

  it('сессия отвечает «не вошёл», пока ключа нет', async () => {
    const { f } = net([{ type: 'error' }])
    const { session } = makeVkApi({ fetch: f, onCaptcha: async () => '', onAuthLost: () => {}, log: () => {} })
    await expect(session()).resolves.toMatchObject({ loggedIn: false })
  })
})
