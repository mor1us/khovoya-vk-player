import { BrowserWindow, session, type Session } from 'electron'

/** Вход в SoundCloud: обычный сайт в отдельном разделе, пароль вводится только там. */
export const scSession = (): Session => session.fromPartition('persist:sc')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** Ключ входа SoundCloud лежит в cookie oauth_token — сайт ставит его после входа. */
export async function scToken(): Promise<string | null> {
  const c = await scSession().cookies.get({ name: 'oauth_token' }).catch(() => [])
  const v = c.find((x) => /soundcloud\.com$/.test(x.domain ?? '') && x.value)?.value
  return v ? decodeURIComponent(v) : null
}

export function scLoginWindow(parent: BrowserWindow | null, log: (m: string) => void): Promise<{ ok: true } | { error: string }> {
  return new Promise((resolve) => {
    const s = scSession()
    s.setUserAgent(UA)
    const w = new BrowserWindow({
      width: 980, height: 760, parent: parent ?? undefined, modal: !!parent, title: 'Вход в SoundCloud', autoHideMenuBar: true, backgroundColor: '#ffffff',
      webPreferences: { session: s, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    let done = false
    const finish = (r: { ok: true } | { error: string }) => {
      if (done) return
      done = true; clearInterval(timer)
      if (!w.isDestroyed()) w.close()
      resolve(r)
    }
    const timer = setInterval(async () => { if (await scToken()) { log('soundcloud: вход выполнен'); finish({ ok: true }) } }, 1500)
    // «Войти через Google/Apple» открывает своё окно — пускаем его в том же разделе, чтобы вход дошёл до сайта
    w.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { session: s, contextIsolation: true, sandbox: true } } }))
    w.webContents.on('did-fail-load', (_e, code, desc, url) => {
      if (code === -3) return // переход отменён — это нормально
      log(`soundcloud: окно входа не загрузилось (${code} ${desc}) ${url.split('?')[0]}`)
      if (/soundcloud\.com\/?(signin)?$/.test(url.split('?')[0])) finish({ error: 'Сайт SoundCloud не открылся. В России для входа нужен VPN — включи его и попробуй снова' })
    })
    w.on('closed', () => { clearInterval(timer); if (!done) { done = true; resolve({ error: 'Окно входа закрыто' }) } })
    log('soundcloud: открываю окно входа')
    void w.loadURL('https://soundcloud.com/signin', { userAgent: UA })
  })
}

export async function scLogout() {
  await scSession().clearStorageData().catch(() => {})
}
