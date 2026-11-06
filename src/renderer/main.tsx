import React from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/app.css'
import './theme/phone.css'
import { App } from './App'

/** Ошибки окна пишем в журнал Хвои (%APPDATA%/Хвоя/khvoya.log) — так их видно и потом можно разобрать. */
const report = (msg: string) => { try { void window.api.invoke('app:log', msg).catch(() => {}) } catch { /* журнал не обязателен */ } }
window.addEventListener('error', (e) => report(`${e.message} @ ${String(e.filename ?? '').split('/').pop()}:${e.lineno}`))
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as Error | undefined
  const m = String(r?.message ?? r ?? '')
  if (/SoundCloud недоступен|VPN|Окно входа закрыто/.test(m)) return // ожидаемые, уже в журнале
  report(`необработанная ошибка: ${m}${r?.stack ? ' | ' + r.stack.split('\n').slice(1, 3).join(' ').trim() : ''}`)
})

/** Если интерфейс упал — не белый экран, а понятное сообщение и кнопка перезагрузки. */
class Guard extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: Error) { return { err: e?.message ?? String(e) } }
  componentDidCatch(e: Error, info: React.ErrorInfo) { report(`интерфейс упал: ${e?.message} | ${String(info.componentStack ?? '').split('\n').slice(1, 4).join(' ').trim()}`) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="crash">
        <h1>Что-то сломалось</h1>
        <p>Ошибка записана в журнал Хвои. Музыка и настройки не пропали.</p>
        <code>{this.state.err}</code>
        <button className="btn-s g" onClick={() => location.reload()}>Перезагрузить</button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Guard><App /></Guard></React.StrictMode>)
