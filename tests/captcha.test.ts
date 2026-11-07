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
describe('CaptchaGate: окно капчи закрывается само', () => {
  it('по таймауту окно просят закрыть — не ждёт ввода, которого никто не примет', async () => {
    vi.useFakeTimers()
    try {
      const done = vi.fn()
      const g = new CaptchaGate(1000, done)
      const p = g.ask(() => {})
      expect(done).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1001)
      expect(await p).toBe('')
      expect(done).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })

  it('ответили из окна — закрыть тоже просим', async () => {
    const done = vi.fn()
    const g = new CaptchaGate(1000, done)
    const p = g.ask(() => {})
    g.answer('abc')
    expect(await p).toBe('abc')
    expect(done).toHaveBeenCalledOnce()
  })

  it('закрыли окно — лишнего сообщения в закрытое окно не шлём', () => {
    const done = vi.fn()
    const g = new CaptchaGate(1000, done)
    g.answer('x')
    g.cancel()
    expect(done).not.toHaveBeenCalled()
  })

  it('вторая капча: сначала убрать прежнюю, потом показать новую', async () => {
    const order: string[] = []
    const g = new CaptchaGate(1000, () => order.push('закрыть'))
    const first = g.ask(() => order.push('показать 1'))
    const second = g.ask(() => order.push('показать 2'))
    expect(await first).toBe('')
    expect(order).toEqual(['показать 1', 'закрыть', 'показать 2'])
    g.answer('ok')
    expect(await second).toBe('ok')
  })
})
