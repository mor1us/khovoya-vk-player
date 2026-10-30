import { describe, it, expect, vi } from 'vitest'
import { login, KATE_CLIENT_ID } from '../src/main/auth/kate'

function deps(json: unknown, img = 'PNGDATA') {
  const urls: string[] = []
  const store = { save: vi.fn(), load: vi.fn(), clear: vi.fn() }
  const f = vi.fn(async (url: string) => {
    urls.push(url)
    if (url.startsWith('https://img')) return { ok: true, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => new TextEncoder().encode(img).buffer } as unknown as Response
    if (url.includes('users.get')) return { ok: true, json: async () => ({ response: [{ first_name: 'Иван', last_name: 'Я', photo_100: 'ava' }] }) } as Response
    return { ok: true, json: async () => json } as Response
  })
  return { d: { fetch: f as unknown as typeof fetch, store }, urls, store }
}
const input = { username: 'u@mail.ru', password: 'secret-pass' }

describe('Kate login', () => {
  it('success saves token and returns ok with name', async () => {
    const { d, urls, store } = deps({ access_token: 'T', user_id: 42 })
    const r = await login(input, d)
    expect(r).toEqual({ kind: 'ok', userName: 'Иван Я', avatar: 'ava' })
    expect(store.save).toHaveBeenCalledWith({ token: 'T', userId: 42 })
    const u = new URL(urls[0])
    expect(u.origin + u.pathname).toBe('https://oauth.vk.com/token')
    expect(u.searchParams.get('grant_type')).toBe('password')
    expect(u.searchParams.get('client_id')).toBe(KATE_CLIENT_ID)
    expect(u.searchParams.get('2fa_supported')).toBe('1')
  })
  it('need_validation → 2fa', async () => {
    const { d } = deps({ error: 'need_validation', phone_mask: '+7 *** ** 12', validation_sid: 'vs' })
    expect(await login(input, d)).toEqual({ kind: '2fa', phoneMask: '+7 *** ** 12', validationSid: 'vs' })
  })
  it('passes code on second step', async () => {
    const { d, urls } = deps({ access_token: 'T', user_id: 1 })
    await login({ ...input, code: '123456' }, d)
    expect(new URL(urls[0]).searchParams.get('code')).toBe('123456')
  })
  it('need_captcha → captcha with data URL', async () => {
    const { d } = deps({ error: 'need_captcha', captcha_sid: 's1', captcha_img: 'https://img/c.jpg' })
    const r = await login(input, d)
    expect(r.kind).toBe('captcha')
    if (r.kind === 'captcha') { expect(r.sid).toBe('s1'); expect(r.imageDataUrl.startsWith('data:image/')).toBe(true) }
  })
  it('invalid_client → friendly error', async () => {
    const { d } = deps({ error: 'invalid_client', error_description: 'Username or password is incorrect' })
    expect(await login(input, d)).toEqual({ kind: 'error', message: 'Неверный логин или пароль' })
  })
  it('never stores the password', async () => {
    const { d, store } = deps({ access_token: 'T', user_id: 1 })
    await login(input, d)
    expect(JSON.stringify(store.save.mock.calls)).not.toContain('secret-pass')
  })
  it('network failure → error, no throw', async () => {
    const r = await login(input, { fetch: (async () => { throw new Error('ENOTFOUND') }) as unknown as typeof fetch, store: { save: vi.fn(), load: vi.fn(), clear: vi.fn() } })
    expect(r).toEqual({ kind: 'error', message: 'Нет подключения к ВК. Проверь интернет.' })
  })
})
