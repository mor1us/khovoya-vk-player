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
    expect(u.searchParams.get('scope')).toContain('audio')
  })
  it('parses token from redirect hash', () => {
    expect(parseRedirect('https://oauth.vk.com/blank.html#access_token=abc&expires_in=0&user_id=42')).toEqual({ token: 'abc', userId: 42 })
  })
  it('parses error from redirect', () => {
    expect(parseRedirect('https://oauth.vk.com/blank.html#error=access_denied&error_description=User%20denied')).toEqual({ error: 'Вход отменён' })
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
