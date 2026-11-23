import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vkWebSubscriptions } from '../src/main/vk/webArtists'

const site = vi.hoisted(() => ({ execute: vi.fn(), ready: () => {} }))

vi.mock('electron', () => ({
  BrowserWindow: class {
    private url = ''
    private destroyed = false
    webContents = Object.assign(new EventEmitter(), {
      getURL: () => this.url,
      setWindowOpenHandler: () => {},
      executeJavaScriptInIsolatedWorld: site.execute
    })
    loadURL(url: string) {
      this.url = url
      site.ready = () => this.webContents.emit('dom-ready')
      // Вёрстка доступна, пока остальные ресурсы страницы ещё загружаются.
      return new Promise<void>(() => {})
    }
    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
  }
}))

vi.mock('../src/main/auth/webSession', () => ({ log: () => {}, vkSession: () => ({}) }))

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })

describe('ранняя загрузка музыкантов ВК', () => {
  it('читает карточки после готовности документа, пока полная загрузка страницы ещё идёт', async () => {
    vi.useFakeTimers()
    const first = { href: 'https://vk.ru/artist/first', name: 'Первый', image: 'https://cdn.example/first.jpg' }
    const second = { href: 'https://vk.ru/artist/second', name: 'Второй', image: 'https://cdn.example/second.jpg' }
    site.execute.mockResolvedValueOnce([first]).mockResolvedValue([first, second])

    const request = vkWebSubscriptions(17)
    expect(site.execute).not.toHaveBeenCalled()
    site.ready()
    await vi.advanceTimersByTimeAsync(700)
    await expect(request).resolves.toMatchObject([
      { name: 'Первый', cover: first.image },
      { name: 'Второй', cover: second.image }
    ])
    expect(site.execute).toHaveBeenCalledTimes(3)
  })
})
