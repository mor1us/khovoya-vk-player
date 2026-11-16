import { useEffect, useState } from 'react'
import type { Settings as S } from '../../shared/types'
import { applySettings } from '../store/settings'
import { isPhone } from '../ui/layout'
import { useUi } from '../store/ui'
import { useUpdates } from '../store/updates'
import { updateText } from '../../shared/updates'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'tg' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => onChange(!on)} />
}

function ShortcutRow({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  const [listening, setListening] = useState(false)
  const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setListening(false); return }
    if (e.key === 'Backspace' || e.key === 'Delete') { onChange(''); setListening(false); return }
    const key = ({ ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space', Enter: 'Enter' } as Record<string, string>)[e.key]
      ?? (/^(Key|Digit)(.)$/.exec(e.code)?.[2])
      ?? (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(e.key) ? e.key : '')
    if (!key) return
    const parts = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', key].filter(Boolean)
    onChange(parts.join('+'))
    setListening(false)
  }
  return <div className="item"><div className="l"><b>{title}</b><span>Работает в игре, когда Хвоя свёрнута или в трее. Нажми поле и клавишу или сочетание. Delete — очистить.</span></div>
    <input className={'filter shortcut' + (listening ? ' listening' : '')} readOnly value={listening ? 'Нажми клавиши…' : value} placeholder="Не задано" onFocus={() => setListening(true)} onClick={() => setListening(true)} onBlur={() => setListening(false)} onKeyDown={keyDown} />
  </div>
}

function UpdatesRow() {
  const u = useUpdates((x) => x.s)
  return (
    <div className="item"><div className="l"><b>Обновления</b><span>{updateText(u) || `Версия ${u.current ?? ''}`}</span></div>
      {u.status === 'ready' ? <button className="btn-s g" onClick={() => void window.api.invoke('upd:install')}>Перезапустить</button>
        : u.status === 'available' ? <button className="btn-s g" onClick={() => void window.api.invoke('upd:download')}>Скачать</button>
        : <button className="btn-s" disabled={u.status === 'checking' || u.status === 'downloading'} onClick={() => void window.api.invoke('upd:check')}>Проверить обновления</button>}
    </div>
  )
}

/** Версия берётся из самого приложения — руками её тут уже один раз забыли обновить. */
function AboutRow() {
  const cur = useUpdates((x) => x.s.current)
  return <div className="item" style={{ border: 0 }}><div className="l"><span>Хвоя {cur ?? ''} · без рекламы · музыка из ВКонтакте</span></div></div>
}

export function Settings({ onLogout }: { onLogout: () => void }) {
  const [s, setS] = useState<S | null>(null)
  const [section, setSection] = useState<'general' | 'keys'>('general')
  useEffect(() => { window.api.invoke('settings:get').then(setS).catch(() => {}) }, [])
  if (!s) return <div className="page" />
  const save = async (patch: Partial<S>) => {
    try { const n = await window.api.invoke('settings:set', patch); setS(n); applySettings(n) } catch (e) { useUi.getState().toast((e as Error).message) }
  }
  // на телефоне нет ни трея, ни Discord, ни своей папки для загрузок — поля прячем,
  // но из типа Settings не убираем: тип общий с компьютерной Хвоёй
  const phone = isPhone()
  return (
    <div className="page">
      <div className="ph"><h1>Настройки</h1></div>
      <div className="seg settings-tabs">
        <button className={section === 'general' ? 'on' : ''} onClick={() => setSection('general')}>Общие</button>
        <button className={section === 'keys' ? 'on' : ''} onClick={() => setSection('keys')}>Клавиши</button>
      </div>
      <div className="set">
        {section === 'general' && <>
        <div className="item"><div className="l"><b>Кроссфейд</b><span>Плавный переход между треками. 0 — выключен.</span></div>
          <div className="range"><input type="range" min={0} max={12} step={1} value={s.crossfadeSec} onChange={(e) => void save({ crossfadeSec: +e.target.value })} /><b>{s.crossfadeSec} с</b></div></div>
        {!phone && <div className="item"><div className="l"><b>Папка для скачанной музыки</b><span>{s.downloadDir}</span></div>
          <button className="btn-s" onClick={async () => { const d = await window.api.invoke('settings:pickDir'); if (d) await save({ downloadDir: d }) }}>Выбрать</button></div>}
        {!phone && <div className="item"><div className="l"><b>Крестик сворачивает в трей</b><span>Музыка продолжит играть, управлять можно медиаклавишами. Выйти — через значок в трее.</span></div>
          <Toggle on={s.closeToTray} onChange={(v) => void save({ closeToTray: v })} /></div>}
        <div className="item"><div className="l"><b>Анимации</b><span>Движущиеся линии Волны и плавные переходы. В свёрнутом окне они всегда выключены.</span></div>
          <Toggle on={s.animations} onChange={(v) => void save({ animations: v })} /></div>
        <div className="item"><div className="l"><b>Комментарии SoundCloud</b><span>Всплывают над волной в той секунде трека, где их оставили, — как на сайте SoundCloud.</span></div>
          <Toggle on={s.scComments} onChange={(v) => void save({ scComments: v })} /></div>
        {!phone && <div className="item"><div className="l"><b>Статус в Discord</b><span>Друзья видят, что ты слушаешь. Нужен ID приложения из Discord Developer Portal — инструкция в файле docs/discord-setup.md.</span></div>
          <Toggle on={s.discordEnabled} onChange={(v) => void save({ discordEnabled: v })} /></div>}
        {!phone && s.discordEnabled && <div className="item"><div className="l"><b>ID приложения Discord</b><span>Только цифры, например 1234567890123456789</span></div>
          <input className="filter wide" defaultValue={s.discordAppId} placeholder="Application ID" onBlur={(e) => void save({ discordAppId: e.target.value })} /></div>}
        <UpdatesRow />
        {!phone && <div className="item"><div className="l"><b>Скример</b><span>Короткий ролик с громким звуком поверх окон.</span></div>
          <button className="btn-s" onClick={() => void window.api.invoke('screamer:play').catch(() => useUi.getState().toast('Не получилось проиграть скример'))}>Проиграть скример</button></div>}
        <div className="item"><div className="l"><b>Аккаунт ВК</b><span>{useUi.getState().session?.userName}</span></div>
          <button className="btn-s" onClick={onLogout}>Выйти</button></div>
        <AboutRow />
        </>}
        {section === 'keys' && (!phone ? <>
          <ShortcutRow title="Предыдущий трек" value={s.previousTrackShortcut} onChange={(previousTrackShortcut) => void save({ previousTrackShortcut })} />
          <ShortcutRow title="Следующий трек" value={s.nextTrackShortcut} onChange={(nextTrackShortcut) => void save({ nextTrackShortcut })} />
          <ShortcutRow title="Пауза" value={s.pauseTrackShortcut} onChange={(pauseTrackShortcut) => void save({ pauseTrackShortcut })} />
          <ShortcutRow title="Лайк" value={s.likeTrackShortcut} onChange={(likeTrackShortcut) => void save({ likeTrackShortcut })} />
          <ShortcutRow title="Дизлайк" value={s.dislikeTrackShortcut} onChange={(dislikeTrackShortcut) => void save({ dislikeTrackShortcut })} />
        </> : <div className="item"><div className="l"><b>Горячие клавиши</b><span>Настройка доступна в компьютерной версии Хвои</span></div></div>)}
      </div>
    </div>
  )
}
