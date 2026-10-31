import { useEffect, useState } from 'react'
import type { Settings as S } from '../../shared/types'
import { applySettings } from '../store/settings'
import { useUi } from '../store/ui'
import { useUpdates } from '../store/updates'
import { updateText } from '../../shared/updates'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'tg' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => onChange(!on)} />
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

export function Settings({ onLogout }: { onLogout: () => void }) {
  const [s, setS] = useState<S | null>(null)
  useEffect(() => { window.api.invoke<S>('settings:get').then(setS).catch(() => {}) }, [])
  if (!s) return <div className="page" />
  const save = async (patch: Partial<S>) => {
    try { const n = await window.api.invoke<S>('settings:set', patch); setS(n); applySettings(n) } catch (e) { useUi.getState().toast((e as Error).message) }
  }
  return (
    <div className="page">
      <div className="ph"><h1>Настройки</h1></div>
      <div className="set">
        <div className="item"><div className="l"><b>Кроссфейд</b><span>Плавный переход между треками. 0 — выключен.</span></div>
          <div className="range"><input type="range" min={0} max={12} step={1} value={s.crossfadeSec} onChange={(e) => void save({ crossfadeSec: +e.target.value })} /><b>{s.crossfadeSec} с</b></div></div>
        <div className="item"><div className="l"><b>Папка для скачанной музыки</b><span>{s.downloadDir}</span></div>
          <button className="btn-s" onClick={async () => { const d = await window.api.invoke<string | null>('settings:pickDir'); if (d) await save({ downloadDir: d }) }}>Выбрать</button></div>
        <div className="item"><div className="l"><b>Крестик сворачивает в трей</b><span>Музыка продолжит играть, управлять можно медиаклавишами. Выйти — через значок в трее.</span></div>
          <Toggle on={s.closeToTray} onChange={(v) => void save({ closeToTray: v })} /></div>
        <div className="item"><div className="l"><b>Анимации</b><span>Движущиеся линии Волны и плавные переходы. В свёрнутом окне они всегда выключены.</span></div>
          <Toggle on={s.animations} onChange={(v) => void save({ animations: v })} /></div>
        <div className="item"><div className="l"><b>Статус в Discord</b><span>Друзья видят, что ты слушаешь. Нужен ID приложения из Discord Developer Portal — инструкция в файле docs/discord-setup.md.</span></div>
          <Toggle on={s.discordEnabled} onChange={(v) => void save({ discordEnabled: v })} /></div>
        {s.discordEnabled && <div className="item"><div className="l"><b>ID приложения Discord</b><span>Только цифры, например 1234567890123456789</span></div>
          <input className="filter" defaultValue={s.discordAppId} placeholder="Application ID" onBlur={(e) => void save({ discordAppId: e.target.value })} /></div>}
        <UpdatesRow />
        <div className="item"><div className="l"><b>Аккаунт ВК</b><span>{useUi.getState().session?.userName}</span></div>
          <button className="btn-s" onClick={onLogout}>Выйти</button></div>
        <div className="item" style={{ border: 0 }}><div className="l"><span>Хвоя 0.2.9 · без рекламы · музыка из ВКонтакте</span></div></div>
      </div>
    </div>
  )
}
