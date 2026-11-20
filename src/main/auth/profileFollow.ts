import { BrowserWindow } from 'electron'
import { setTimeout as pause } from 'node:timers/promises'
import { log, vkSession } from './webSession'
import { WEB_UA } from './webToken'
import { scSession } from '../sc/scAuth'
import { SC_UA } from '../sc/soundcloud'
import { vkArtistProfile } from '../vk/webArtistsLogic'
import { profileFollowControl, soundCloudProfile, type FollowService } from './profileFollowLogic'

export async function profileFollow(service: FollowService, link: string, on: boolean | undefined, assertAccount: () => Promise<void>): Promise<boolean> {
  const normalize = (value: string) => service === 'vk' ? vkArtistProfile(value) : soundCloudProfile(value)?.href
  const profile = normalize(link)
  if (!profile) throw new Error('Не удалось найти официальный профиль артиста')
  const path = new URL(profile).pathname.replace(/\/$/, '')
  const sameProfile = (value: string) => {
    const normalized = normalize(value)
    return !!normalized && new URL(normalized).pathname.replace(/\/$/, '') === path
  }
  const w = new BrowserWindow({
    show: false, width: 1100, height: 800,
    webPreferences: { session: service === 'vk' ? vkSession() : scSession(), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  })
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  w.webContents.on('will-navigate', (event, url) => { if (!sameProfile(url)) event.preventDefault() })
  w.webContents.on('will-redirect', (event, url) => { if (!sameProfile(url)) event.preventDefault() })
  const deadline = Date.now() + 17_000
  const watchdog = setTimeout(() => { if (!w.isDestroyed()) w.destroy() }, 18_000)
  const load = () => w.loadURL(profile, { userAgent: service === 'vk' ? WEB_UA : SC_UA })
  const control = async (action: Parameters<typeof profileFollowControl>[1]): Promise<boolean | null> => {
    if (!sameProfile(w.webContents.getURL())) throw new Error('Открылась другая страница')
    const code = `(${profileFollowControl.toString()})(${JSON.stringify(service)}, ${JSON.stringify(action)})`
    return w.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code }])
  }
  const waitFor = async (expected?: boolean, confirm = false) => {
    while (Date.now() < deadline) {
      const state = await control('read')
      if (state !== null && (expected === undefined || state === expected)) return state
      if (confirm && await control('confirm')) confirm = false
      await pause(250)
    }
    throw new Error('Страница не подтвердила состояние подписки')
  }
  let step = 'открытие профиля'
  try {
    await load()
    step = 'чтение кнопки'
    const before = await waitFor()
    if (on === undefined || on === before) return before
    await assertAccount()
    step = 'действие кнопки'
    if (await control(on ? 'follow' : 'unfollow') === null) throw new Error('Не найдена кнопка подписки')
    await waitFor(on, !on)
    step = 'проверка после перезагрузки'
    await load()
    return await waitFor(on)
  } catch {
    log(`подписка ${service}: не удалось подтвердить, этап — ${step}`)
    throw new Error(`Не удалось подтвердить подписку в ${service === 'vk' ? 'ВК' : 'SoundCloud'}`)
  } finally {
    clearTimeout(watchdog)
    if (!w.isDestroyed()) w.destroy()
  }
}
