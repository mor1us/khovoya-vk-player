import { describe, it, expect } from 'vitest'
import { isFreshLogin } from '../src/main/sc/soundcloud'

describe('isFreshLogin', () => {
  it('старый ключ входом не считается', () => {
    // так окно входа и закрывалось через полторы секунды: cookie от прошлого входа уже лежала
    expect(isFreshLogin('OLD', 'OLD')).toBe(false)
    expect(isFreshLogin('OLD', null)).toBe(false)
    expect(isFreshLogin(null, null)).toBe(false)
  })

  it('новый ключ — вход', () => {
    expect(isFreshLogin('OLD', 'NEW')).toBe(true)
    expect(isFreshLogin(null, 'NEW')).toBe(true)
  })
})
