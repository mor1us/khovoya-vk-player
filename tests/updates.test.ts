import { describe, it, expect } from 'vitest'
import { updateText, feedFromConfig } from '../src/shared/updates'

describe('updateText', () => {
  it('human texts', () => {
    expect(updateText({ status: 'checking' })).toBe('Проверяю обновления…')
    expect(updateText({ status: 'none', current: '0.2.8' })).toBe('У тебя последняя версия 0.2.8')
    expect(updateText({ status: 'available', version: '0.2.9' })).toBe('Доступна версия 0.2.9')
    expect(updateText({ status: 'downloading', progress: 0.426 })).toBe('Скачиваю обновление… 43%')
    expect(updateText({ status: 'ready', version: '0.2.9' })).toBe('Версия 0.2.9 скачана — перезапусти, чтобы обновиться')
    expect(updateText({ status: 'error' })).toBe('Не удалось проверить обновления. Попробуй позже.')
    expect(updateText({ status: 'disabled' })).toBe('Автообновление ещё не настроено')
  })
})

describe('feedFromConfig', () => {
  it('needs owner and repo', () => {
    expect(feedFromConfig({ owner: 'morius', repo: 'khvoya' })).toEqual({ provider: 'github', owner: 'morius', repo: 'khvoya' })
    expect(feedFromConfig({ owner: '', repo: 'khvoya' })).toBeNull()
    expect(feedFromConfig(undefined)).toBeNull()
  })
})
