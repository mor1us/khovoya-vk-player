import { useState } from 'react'
import type { LoginStep } from '../../shared/types'
import * as I from '../ui/icons'

export function Login({ onDone }: { onDone: (s: Extract<LoginStep, { kind: 'ok' }>) => void }) {
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [code, setCode] = useState('')
  const [captcha, setCaptcha] = useState<{ sid: string; img: string } | null>(null)
  const [captchaKey, setKey] = useState('')
  const [step, setStep] = useState<'pass' | '2fa'>('pass')
  const [phone, setPhone] = useState<string | undefined>()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false)
  const [pasted, setPasted] = useState('')

  async function submit(e?: React.FormEvent, withCaptcha = captcha) {
    e?.preventDefault()
    if (!username.trim() || !password) { setErr('Введи логин и пароль'); return }
    if (step === '2fa' && !code.trim()) { setErr('Введи код подтверждения'); return }
    setBusy(true); setErr('')
    try {
      const r = await window.api.invoke<LoginStep>('auth:login', {
        username: username.trim(), password, code: step === '2fa' ? code.trim() : undefined,
        captchaSid: withCaptcha?.sid, captchaKey: withCaptcha ? captchaKey : undefined
      })
      if (r.kind === 'ok') return onDone(r)
      if (r.kind === '2fa') { setStep('2fa'); setPhone(r.phoneMask); setCaptcha(null) }
      if (r.kind === 'captcha') { setCaptcha({ sid: r.sid, img: r.imageDataUrl }); setKey('') }
      if (r.kind === 'error') { setErr(r.message); setCaptcha(null) }
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="left drag">
        <div className="brand" style={{ color: 'var(--k)' }}><i style={{ background: 'var(--k)' }} />ХВОЯ</div>
        <h1>Музыка<br />из ВК.<br />Без рекламы.</h1>
        <p>Твои треки, плейлисты и Волна, которая учится на твоих лайках.</p>
      </div>
      <div className="right">
        <div className="wins nodrag" style={{ position: 'absolute', top: 18, right: 18 }}>
          <button onClick={() => window.api.invoke('win:min')}><I.IMin /></button>
          <button className="x" onClick={() => window.api.invoke('win:close')}><I.IClose /></button>
        </div>
        <form onSubmit={submit}>
          <h2>{step === 'pass' ? 'Вход через ВК' : 'Код подтверждения'}</h2>
          {step === 'pass' ? (
            <>
              <input className="field" placeholder="Телефон или почта" value={username} onChange={(e) => setU(e.target.value)} autoFocus />
              <input className="field" placeholder="Пароль" type="password" value={password} onChange={(e) => setP(e.target.value)} />
            </>
          ) : (
            <>
              <div className="hint">ВК прислал код {phone ? `на номер ${phone}` : 'в SMS или в приложение для кодов'}.</div>
              <input className="field" placeholder="Код" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </>
          )}
          {captcha && (
            <div className="captcha" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="hint">ВК просит подтвердить, что ты не робот:</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img src={captcha.img} alt="капча" />
                <button type="button" className="pill" onClick={() => { setCaptcha(null); void submit(undefined, null) }}>Другая картинка</button>
              </div>
              <input className="field" placeholder="Символы с картинки" value={captchaKey} onChange={(e) => setKey(e.target.value)} autoFocus />
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Входим…' : step === 'pass' ? 'Войти' : 'Подтвердить'}</button>
          {step === '2fa' && <button type="button" className="btn ghost" onClick={() => { setStep('pass'); setCode(''); setErr('') }}>Назад</button>}
          <div className="hint" style={{ textAlign: 'center' }}>или</div>
          <button type="button" className={'btn' + (/окно ВК/.test(err) ? '' : ' ghost')} disabled={busy} onClick={async () => {
            setBusy(true); setErr('')
            try { const r = await window.api.invoke<LoginStep>('auth:browser'); if (r.kind === 'ok') onDone(r); else if (r.kind === 'error' && r.message !== 'Окно входа закрыто') setErr(r.message) }
            catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
          }}>Войти через окно ВК (код, SMS, QR)</button>
          {!manual ? (
            <button type="button" className="hint" style={{ textDecoration: 'underline', alignSelf: 'center' }} onClick={() => setManual(true)}>Не получается? Войти через свой браузер</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--ln)', paddingTop: 14 }}>
              <div className="hint">1. Открой страницу входа в своём браузере и войди в ВК (если спросят доступ для Kate Mobile — «Разрешить»).<br />2. Попадёшь на пустую страницу с надписью «Пожалуйста, не копируйте данные из адресной строки» — это нормально, ключ нужен только этому приложению на твоём ПК. Скопируй адрес этой страницы целиком и вставь ниже.</div>
              <button type="button" className="btn ghost" onClick={() => void window.api.invoke('auth:openBrowser')}>1. Открыть страницу входа в браузере</button>
              <input className="field" placeholder="2. Вставь адрес страницы после входа" value={pasted} onChange={(e) => setPasted(e.target.value)} />
              <button type="button" className="btn" disabled={busy || !pasted.trim()} onClick={async () => {
                setBusy(true); setErr('')
                try { const r = await window.api.invoke<LoginStep>('auth:token', pasted); if (r.kind === 'ok') onDone(r); else if (r.kind === 'error') setErr(r.message) }
                catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
              }}>Готово</button>
            </div>
          )}
          <div className="hint">Пароль уходит только на сервер ВК и нигде не сохраняется. Приложение хранит лишь ключ доступа, зашифрованный Windows.</div>
        </form>
      </div>
    </div>
  )
}
