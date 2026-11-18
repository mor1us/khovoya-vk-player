import { BrowserWindow } from 'electron'
import { setTimeout as pause } from 'node:timers/promises'
import { log, vkSession } from '../auth/webSession'
import { WEB_UA } from '../auth/webToken'
import { parseVkArtistCards, vkArtistProfile, vkArtistsPage, vkWebUrl } from './webArtistsLogic'

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

// Выполняется в отдельном мире страницы. Читаем только видимые карточки в блоке списка.
function visibleArtists() {
  const title = Array.from(document.querySelectorAll('h1,h2,h3,span,a,div,p,strong,button')).reverse().find((element) =>
    element.textContent?.trim() === 'Музыканты' && element.getClientRects().length)
  if (!title) return []
  for (let scope = title.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
    const cards = Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href*="/artist/"]')).filter((a) => a.getClientRects().length)
    if (!cards.length) continue
    return cards.map((a) => {
      const img = a.querySelector('img')
      return { href: a.href, name: a.innerText.trim() || a.getAttribute('aria-label') || a.title || img?.alt || '', image: img?.currentSrc || img?.src }
    })
  }
  return []
}

export async function vkWebSubscriptions(userId: number) {
  const target = vkArtistsPage(userId)
  const w = vkPageWindow(false)
  const deadline = Date.now() + 12_000
  const watchdog = setTimeout(() => { if (!w.isDestroyed()) w.destroy() }, 13_000)
  try {
    await w.loadURL(target.href, { userAgent: WEB_UA })
    const requireListPage = () => {
      const page = vkWebUrl(w.webContents.getURL())
      if (!page || page.pathname !== target.pathname || page.searchParams.get('block') !== 'my_artists' || page.searchParams.get('section') !== 'all') {
        throw new Error('переход со страницы музыкантов')
      }
    }
    while (Date.now() < deadline && !w.isDestroyed()) {
      requireListPage()
      const cards = await w.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${visibleArtists.toString()})()` }])
      requireListPage()
      const artists = parseVkArtistCards(cards)
      if (artists.length) {
        log(`Музыканты ВК: загружено карточек ${artists.length}`)
        return artists
      }
      await pause(350)
    }
    log('Музыканты ВК: список карточек не появился')
  } catch {
    log('Музыканты ВК: авторизованная страница списка не открылась или перенаправила запрос')
  } finally {
    clearTimeout(watchdog)
    if (!w.isDestroyed()) w.destroy()
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
