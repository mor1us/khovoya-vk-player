import { describe, it, expect } from 'vitest'
import { authorizeUrl, parseRedirect } from '../src/main/auth/browserLogin'
import { friendlyVkError } from '../src/main/auth/kate'

describe('browser login (implicit flow)', () => {
  it('authorize URL uses Kate client and blank.html redirect', () => {
    const u = new URL(authorizeUrl())
    expect(u.origin + u.pathname).toBe('https://oauth.vk.com/authorize')
    expect(u.searchParams.get('client_id')).toBe('2685278')
    expect(u.searchParams.get('response_type')).toBe('token')
    expect(u.searchParams.get('redirect_uri')).toBe('https://oauth.vk.com/blank.html')
    expect(u.searchParams.get('scope')).toBe('1073737727')
    expect(u.searchParams.get('display')).toBe('page')
    expect(u.searchParams.has('v')).toBe(false)
  })
  it('parses token from redirect hash', () => {
    expect(parseRedirect('https://oauth.vk.com/blank.html#access_token=abc&expires_in=0&user_id=42')).toEqual({ token: 'abc', userId: 42 })
  })
  it('parses error from redirect', () => {
    expect(parseRedirect('https://oauth.vk.com/blank.html#error=access_denied&error_description=User%20denied')).toEqual({ error: 'Вход отменён' })
  })
  it('accepts api.vk.com/blank.html too', () => {
    expect(parseRedirect('https://api.vk.com/blank.html#access_token=x1&expires_in=0&user_id=7')).toEqual({ token: 'x1', userId: 7 })
  })
  it('ignores other pages', () => {
    expect(parseRedirect('https://id.vk.com/auth?x=1')).toBeNull()
    expect(parseRedirect('https://oauth.vk.com/blank.html')).toBeNull()
  })
})

describe('friendlyVkError', () => {
  it('too many attempts → Russian hint to use the VK window', () => {
    expect(friendlyVkError('Too many attempts were made to sign in to this account with a password. Please use a different sign-in method or try again after a few hours.'))
      .toBe('ВК временно запретил вход по паролю (слишком много попыток). Нажми «Войти через окно ВК» — там можно войти по коду или QR.')
  })
  it('unknown description passes through with prefix', () => { expect(friendlyVkError('Something')).toBe('ВК не пустил: Something') })
})

import { parseManual } from '../src/main/auth/browserLogin'
describe('parseManual (pasted from a normal browser)', () => {
  it('full redirect URL with spaces around', () => {
    expect(parseManual('  https://oauth.vk.com/blank.html#access_token=vk1.a.TOKEN&expires_in=0&user_id=5\n')).toEqual({ token: 'vk1.a.TOKEN', userId: 5 })
  })
  it('just the hash part', () => { expect(parseManual('access_token=abc123&user_id=9')).toEqual({ token: 'abc123', userId: 9 }) })
  it('bare token (user id unknown → 0)', () => { expect(parseManual('vk1.a.' + 'x'.repeat(80))).toEqual({ token: 'vk1.a.' + 'x'.repeat(80), userId: 0 }) })
  it('garbage → null', () => { expect(parseManual('привет')).toBeNull(); expect(parseManual('')).toBeNull() })
})
