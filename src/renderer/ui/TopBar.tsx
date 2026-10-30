import { useEffect, useRef, useState } from 'react'
import { useUi, type Tab } from '../store/ui'
import * as I from './icons'

const TABS: [Tab, string][] = [['home', 'Главная'], ['mine', 'Моё'], ['playlists', 'Плейлисты'], ['downloads', 'Загрузки']]
export const searchRef: { current: HTMLInputElement | null } = { current: null }

export function TopBar({ onLogout }: { onLogout: () => void }) {
  const tab = useUi((s) => s.tab)
  const query = useUi((s) => s.query)
  const session = useUi((s) => s.session)
  const [menu, setMenu] = useState(false)
  const [focus, setFocus] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { searchRef.current = input.current }, [])
  const hist: string[] = focus && !query ? JSON.parse(localStorage.getItem('searchHistory') ?? '[]') : []
  const active = (t: Tab) => tab === t || (t === 'playlists' && tab === 'playlist')
  return (
    <div className="bar drag">
      <nav className="tabs nodrag">{TABS.map(([t, l]) => <button key={t} className={active(t) ? 'on' : ''} onClick={() => useUi.getState().go(t)}>{l}</button>)}</nav>
      <div className="search nodrag" style={{ position: 'relative' }}>
        <I.ISearch size={15} />
        <input ref={input} placeholder="Найти…" value={query}
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onChange={(e) => useUi.getState().setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { useUi.getState().submit(); input.current?.blur() } if (e.key === 'Escape') input.current?.blur() }} />
        {query ? <button onClick={() => useUi.getState().setQuery('')} title="Очистить"><I.IX size={14} /></button> : <kbd>Ctrl F</kbd>}
        {hist.length > 0 && (
          <div className="menu" style={{ top: 46, left: 0, right: 0 }}>
            <div className="lbl">Недавние запросы</div>
            {hist.map((h) => <button key={h} onMouseDown={() => useUi.getState().submit(h)}>{h}</button>)}
          </div>
        )}
      </div>
      <div className="nodrag" style={{ position: 'relative' }}>
        <button className="avatar" onClick={() => setMenu(!menu)} title={session?.userName}>{session?.avatar ? <img src={session.avatar} alt="" /> : (session?.userName?.[0] ?? 'Х')}</button>
        {menu && (
          <div className="menu" style={{ right: 0, top: 40 }} onMouseLeave={() => setMenu(false)}>
            <div className="lbl">{session?.userName}</div>
            <button onClick={() => { setMenu(false); useUi.getState().go('settings') }}>Настройки</button>
            <div className="sep" />
            <button onClick={() => { setMenu(false); onLogout() }}>Выйти из ВК</button>
          </div>
        )}
      </div>
      <div className="wins nodrag">
        <button onClick={() => window.api.invoke('win:min')} title="Свернуть"><I.IMin /></button>
        <button onClick={() => window.api.invoke('win:max')} title="Развернуть"><I.IMax /></button>
        <button className="x" onClick={() => window.api.invoke('win:close')} title="Закрыть"><I.IClose /></button>
      </div>
    </div>
  )
}
