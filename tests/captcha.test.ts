import { describe, it, expect, vi } from 'vitest'
import { CaptchaGate } from '../src/main/auth/captcha'

describe('CaptchaGate', () => {
  it('отдаёт то, что ввели в окне', async () => {
    const g = new CaptchaGate()
    const show = vi.fn()
    const p = g.ask(show)
    expect(show).toHaveBeenCalledOnce()
    expect(g.waiting).toBe(true)
    g.answer('abc')
    expect(await p).toBe('abc')
    expect(g.waiting).toBe(false)
  })

  it('вторая капча не оставляет первую висеть вечно', async () => {
    const g = new CaptchaGate()
    const first = g.ask(() => {})
    const second = g.ask(() => {})
    expect(await first).toBe('') // прежнее ожидание закрыто пустым ответом
    g.answer('ok')
    expect(await second).toBe('ok')
  })

  it('не ответили — пустой ответ по таймауту, запрос не висит', async () => {
    vi.useFakeTimers()
    try {
      const g = new CaptchaGate(1000)
      const p = g.ask(() => {})
      vi.advanceTimersByTime(1001)
      expect(await p).toBe('')
    } finally { vi.useRealTimers() }
  })

  it('закрыли окно — ожидание снимается', async () => {
    const g = new CaptchaGate()
    const p = g.ask(() => {})
    g.cancel()
    expect(await p).toBe('')
    expect(g.waiting).toBe(false)
  })

  it('ответ, когда никто не ждёт, ничего не ломает', () => {
    const g = new CaptchaGate()
    expect(() => g.answer('x')).not.toThrow()
    expect(g.waiting).toBe(false)
  })

  it('пустой и неправильный ответ приходят строкой', async () => {
    const g = new CaptchaGate()
    const p = g.ask(() => {})
    g.answer(undefined as unknown as string)
    expect(await p).toBe('')
  })
})
