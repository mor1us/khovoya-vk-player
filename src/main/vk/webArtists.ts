import { BrowserWindow } from 'electron'
import { setTimeout as pause } from 'node:timers/promises'
import { log, vkSession } from '../auth/webSession'
import { WEB_UA } from '../auth/webToken'
import { parseVkArtistCards, visibleArtists, vkArtistProfile, vkArtistsPage, vkArtistsRoute, vkWebUrl } from './webArtistsLogic'

function vkPageWindow(show: boolean, parent?: BrowserWindow) {
  const w = new BrowserWindow({
    show, parent, width: 1040, height: 780, autoHideMenuBar: true,
    webPreferences: { session: vkSession(), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: show }
  })
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  w.webContents.on('will-navigate', (event, url) => { if (!vkWebUrl(url)) event.preventDefault() })
  w.webContents.on('will-redirect', (event, url) => { if (!vkWebUrl(url)) event.preventDefault() })
  return w
}

type ListFailure = 'verification' | 'login' | 'load' | 'route' | 'no-cards'

async function readVkArtistList(target: URL): Promise<{ artists: ReturnType<typeof parseVkArtistCards> } | { failure: ListFailure }> {
  const w = vkPageWindow(false)
  const deadline = Date.now() + 12_000
  const watchdog = setTimeout(() => { if (!w.isDestroyed()) w.destroy() }, 13_000)
  let restricted: 'login' | 'verification' | undefined
  w.webContents.on('will-redirect', (_event, url) => {
    const route = vkArtistsRoute(url, target)
    if (route === 'login' || route === 'verification') restricted = route
  })
  const route = () => vkArtistsRoute(w.webContents.getURL(), target)
  try {
    await w.loadURL(target.href, { userAgent: WEB_UA })
    let artists: ReturnType<typeof parseVkArtistCards> = []
    let waitForImagesUntil: number | undefined
    while (Date.now() < deadline && !w.isDestroyed()) {
      const before = route()
      if (before !== 'list') return { failure: before === 'other' ? 'route' : before }
      const cards = await w.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${visibleArtists.toString()})()` }])
      const after = route()
      if (after !== 'list') return { failure: after === 'other' ? 'route' : after }
      artists = parseVkArtistCards([...artists.map(({ link, name, cover }) => ({ href: link ?? '', name, image: cover })), ...cards])
      if (artists.length) {
        waitForImagesUntil ??= Date.now() + 1400
        if (artists.every((artist) => artist.cover) || Date.now() >= waitForImagesUntil) break
      }
      await pause(350)
    }
    if (artists.length) {
      log(`Музыканты ВК: загружено карточек ${artists.length}, с аватарками ${artists.filter((artist) => artist.cover).length}`)
      return { artists }
    }
    return { failure: 'no-cards' }
  } catch {
    const current = w.isDestroyed() ? restricted : route()
    return { failure: current === 'login' || current === 'verification' ? current : restricted ?? 'load' }
  } finally {
    clearTimeout(watchdog)
    if (!w.isDestroyed()) w.destroy()
  }
}

export async function vkWebSubscriptions(userId: number) {
  const target = vkArtistsPage(userId)
  const messages: Record<ListFailure, string> = {
    verification: 'ВК запросил проверку',
    login: 'ВК открыл страницу входа',
    load: 'прервалась загрузка страницы',
    route: 'ВК перенаправил со страницы списка',
    'no-cards': 'карточки музыкантов не появились'
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await readVkArtistList(target)
    if ('artists' in result) return result.artists
    log(`Музыканты ВК: ${messages[result.failure]}, попытка ${attempt}`)
    if (result.failure !== 'load' && result.failure !== 'route') break
    if (attempt === 1) await pause(800)
  }
  throw new Error('Не удалось загрузить раздел «Музыканты» из ВК')
}

export async function vkArtistWindow(parent: BrowserWindow | null, url: string) {
  const profile = vkArtistProfile(url)
  if (!profile) throw new Error('Не удалось открыть профиль ВК')
  const w = vkPageWindow(true, parent ?? undefined)
  const closed = new Promise<void>((resolve) => w.once('closed', resolve))
  try { await w.loadURL(profile, { userAgent: WEB_UA }) }
  catch {
    if (w.isDestroyed()) return
    w.destroy()
    throw new Error('Профиль ВК не загрузился')
  }
  await closed
}
