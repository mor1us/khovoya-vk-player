import { useState } from 'react'
import type { LoginStep } from '../../shared/types'
import * as I from '../ui/icons'
import { isPhone } from '../ui/layout'

export function Login({ onDone }: { onDone: (s: Extract<LoginStep, { kind: 'ok' }>) => void }) {
  const phone = isPhone()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true); setErr('')
    try {
      const r = await window.api.invoke('auth:browser')
      if (r.kind === 'ok') onDone(r)
      else if (r.kind === 'error' && r.message !== 'Окно входа закрыто') setErr(r.message)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className={'login' + (phone ? ' phone' : '')}>
      <div className="left drag">
        <div className="brand" style={{ color: 'var(--k)' }}><i style={{ background: 'var(--k)' }} />ХВОЯ</div>
        <h1>Музыка<br />из ВК.<br />Без рекламы.</h1>
        <p>Твои треки, плейлисты и Волна, которая учится на твоих лайках.</p>
      </div>
      <div className="right">
        {!phone && <div className="wins nodrag" style={{ position: 'absolute', top: 18, right: 18 }}>
          <button onClick={() => window.api.invoke('win:min')}><I.IMin /></button>
          <button className="x" onClick={() => window.api.invoke('win:close')}><I.IClose /></button>
        </div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
          <h2>Вход через ВК</h2>
          <div className="hint" style={{ fontSize: 14, color: 'var(--t2)' }}>Откроется обычная страница ВКонтакте. Войди любым удобным способом — QR-код, код из SMS или пароль. {phone ? 'Страница закроется сама.' : 'Окно закроется само.'}</div>
          <button className="btn" disabled={busy} onClick={() => void go()}>{busy ? 'Жду вход на странице ВК…' : 'Войти через ВК'}</button>
          {err && <div className="err">{err}</div>}
          <div className="hint">Пароль вводится только на сайте ВК — приложение его не видит. Сессия хранится {phone ? 'на телефоне' : 'на твоём компьютере в зашифрованном виде'}; «Выйти» в настройках её удаляет.</div>
        </div>
      </div>
    </div>
  )
}
