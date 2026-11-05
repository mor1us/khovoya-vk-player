import { describe, it, expect, vi } from 'vitest'
import { bootSafely } from '../src/main/system/boot'

describe('bootSafely', () => {
  it('подготовка прошла — true, жаловаться не на что', async () => {
    const onError = vi.fn()
    expect(await bootSafely(async () => {}, onError)).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it('подготовка упала — ошибка наружу, но не исключение: окно всё равно откроется', async () => {
    const onError = vi.fn()
    const err = new Error('не создалась папка')
    await expect(bootSafely(async () => { throw err }, onError)).resolves.toBe(false)
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('упало не исключением, а чем попало — тоже не падаем', async () => {
    const onError = vi.fn()
    await expect(bootSafely(async () => { throw 'строка' }, onError)).resolves.toBe(false)
    expect(onError).toHaveBeenCalledWith('строка')
  })
})
