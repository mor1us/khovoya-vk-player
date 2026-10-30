import { describe, it, expect, vi } from 'vitest'
import { parseWebToken, TokenKeeper, SessionLostError, WEB_TOKEN_APP_ID, webTokenRequest } from '../src/main/auth/webToken'

describe('parseWebToken', () => {
  it('okay → token, user id, expires', () => {
    expect(parseWebToken({ type: 'okay', data: { access_token: 'T', user_id: 42, expires: 1800000000 } })).toEqual({ token: 'T', userId: 42, expires: 1800000000 })
  })
  it('user id from auth_info', () => {
    expect(parseWebToken({ type: 'okay', data: { access_token: 'T', auth_info: { user: { id: 7 } } } })).toMatchObject({ userId: 7 })
  })
  it('not okay / no token → SessionLostError', () => {
    expect(() => parseWebToken({ type: 'error', error_info: 'x' })).toThrow(SessionLostError)
    expect(() => parseWebToken({ type: 'okay', data: {} })).toThrow(SessionLostError)
    expect(() => parseWebToken(null)).toThrow(SessionLostError)
  })
})

describe('webTokenRequest', () => {
  it('posts version=1 and web app id to login.vk.ru with id.vk.ru origin', () => {
    const r = webTokenRequest()
    expect(r.url).toBe('https://login.vk.ru/?act=web_token')
    expect(new URLSearchParams(r.body).get('app_id')).toBe(String(WEB_TOKEN_APP_ID))
    expect(new URLSearchParams(r.body).get('version')).toBe('1')
    expect(r.headers.Origin).toBe('https://id.vk.ru')
  })
})

describe('webTokenRequest for vk.com', () => {
  it('uses login.vk.com and id.vk.com origin', () => {
    const r = webTokenRequest('com')
    expect(r.url).toBe('https://login.vk.com/?act=web_token')
    expect(r.headers.Origin).toBe('https://id.vk.com')
  })
})

describe('TokenKeeper', () => {
  const tok = (n: number) => ({ token: 'T' + n, userId: 1, expires: 0 })
  it('caches for 5 minutes, then refreshes', async () => {
    let now = 0, n = 0
    const k = new TokenKeeper(async () => tok(++n), () => now)
    expect((await k.get())!.token).toBe('T1')
    now = 4 * 60_000; expect((await k.get())!.token).toBe('T1')
    now = 5 * 60_000 + 1; expect((await k.get())!.token).toBe('T2')
  })
  it('invalidate forces refresh', async () => {
    let n = 0
    const k = new TokenKeeper(async () => tok(++n), () => 0)
    await k.get(); k.invalidate()
    expect((await k.get())!.token).toBe('T2')
  })
  it('concurrent gets share one request', async () => {
    const f = vi.fn(async () => tok(1))
    const k = new TokenKeeper(f, () => 0)
    await Promise.all([k.get(), k.get(), k.get()])
    expect(f).toHaveBeenCalledOnce()
  })
  it('session lost → null and calls onLost', async () => {
    const onLost = vi.fn()
    const k = new TokenKeeper(async () => { throw new SessionLostError() }, () => 0, onLost)
    expect(await k.get()).toBeNull()
    expect(onLost).toHaveBeenCalledOnce()
  })
  it('network error keeps the old token if there is one', async () => {
    let now = 0, fail = false
    const k = new TokenKeeper(async () => { if (fail) throw new Error('net'); return tok(1) }, () => now)
    await k.get(); fail = true; now = 10 * 60_000
    expect((await k.get())!.token).toBe('T1')
  })
  it('userId exposed after get', async () => {
    const k = new TokenKeeper(async () => ({ token: 'x', userId: 99, expires: 0 }), () => 0)
    await k.get(); expect(k.userId()).toBe(99)
  })
})
