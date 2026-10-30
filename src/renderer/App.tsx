import { useEffect, useState } from 'react'
import type { Session, Settings } from '../shared/types'
import { useUi } from './store/ui'
import { useLibrary } from './store/library'
import { useWave, bindWave } from './store/wave'
import { player, playerHooks, usePlayer } from './store/playerInstance'
import { bindMedia } from './player/media'
import { Stage, MiniBar } from './ui/Stage'
import { TopBar, searchRef } from './ui/TopBar'
import { Login } from './pages/Login'
import { Pages } from './pages/Pages'
import { DialogHost } from './ui/Dialog'
import { applySettings } from './store/settings'
import { bindDownloads } from './store/downloads'

let booted = false
function boot() {
  if (booted) return
  booted = true
  player.getState().restore()
  bindDownloads()
  bindMedia(player, () => searchRef.current?.focus())
  const w = bindWave()
  playerHooks.trackChange.push(w.onTrackChange)
  playerHooks.queueLow.push((r) => void w.onQueueLow(r))
  playerHooks.notice.push((m) => useUi.getState().toast(m))
  setInterval(() => { if (player.getState().playing) player.getState().persist() }, 5000)
  window.addEventListener('beforeunload', () => player.getState().persist())
  window.api.on('sys:state', (s: { background: boolean }) => {
    useUi.setState({ background: s.background })
    document.documentElement.classList.toggle('paused-ui', s.background)
  })
  window.api.invoke<Settings>('settings:get').then(applySettings).catch(() => {})
  window.api.on('tray:cmd', (c: string) => { if (c === 'toggle') void player.getState().toggle(); if (c === 'next') void player.getState().next() })
}

function useWide() {
  const [wide, set] = useState(window.innerWidth >= 1100)
  useEffect(() => { const f = () => set(window.innerWidth >= 1100); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return wide
}

function CaptchaModal() {
  const [c, setC] = useState<{ sid: string; imageDataUrl: string } | null>(null)
  const [key, setKey] = useState('')
  useEffect(() => window.api.on('vk:captcha', (x) => { setC(x); setKey('') }), [])
  if (!c) return null
  const send = (k: string) => { void window.api.invoke('vk:captchaAnswer', k); setC(null) }
  return (
    <div className="modal"><form className="box" onSubmit={(e) => { e.preventDefault(); send(key) }}>
      <h3 style={{ font: '800 20px var(--H)' }}>ВК просит капчу</h3>
      <img src={c.imageDataUrl} alt="капча" style={{ height: 60, borderRadius: 8, background: '#fff', alignSelf: 'flex-start' }} />
      <input className="field" autoFocus placeholder="Символы с картинки" value={key} onChange={(e) => setKey(e.target.value)} />
      <button className="btn">Отправить</button>
      <button type="button" className="btn ghost" onClick={() => send('')}>Отмена</button>
    </form></div>
  )
}

function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>
}

function Offline() {
  const [on, set] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => set(true), b = () => set(false)
    window.addEventListener('online', a); window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on ? null : <div className="offline">Нет подключения — играют только скачанные треки</div>
}

export function App() {
  const session = useUi((s) => s.session)
  const wide = useWide()
  const hasTrack = usePlayer((s) => !!s.current)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    boot()
    window.api.invoke<Session>('auth:session').then((s) => useUi.getState().setSession(s)).catch(() => useUi.getState().setSession({ loggedIn: false })).finally(() => setChecking(false))
    return window.api.on('auth:lost', () => { useUi.getState().setSession({ loggedIn: false }); useUi.getState().toast('Сессия ВК закончилась, войди снова') })
  }, [])

  useEffect(() => {
    if (!session?.loggedIn) return
    void useLibrary.getState().loadMine()
    void useLibrary.getState().loadPlaylists()
    void useWave.getState().load()
  }, [session?.loggedIn])

  async function logout() {
    await window.api.invoke('auth:logout')
    player.getState().toggle().catch(() => {})
    useLibrary.setState({ mine: [], mineLoaded: false, playlists: [] })
    useUi.getState().setSession({ loggedIn: false })
  }

  if (checking) return <div style={{ height: '100%' }} />
  if (!session?.loggedIn) return <><Login onDone={(r) => useUi.getState().setSession({ loggedIn: true, userName: r.userName, avatar: r.avatar })} /><Toasts /><Offline /></>

  return (
    <div className={'app' + (wide ? '' : ' narrow')}>
      {wide && <Stage />}
      <main className="main"><TopBar onLogout={logout} /><Pages onLogout={logout} /></main>
      {!wide && hasTrack && <MiniBar />}
      <Toasts /><Offline /><CaptchaModal /><DialogHost />
    </div>
  )
}
