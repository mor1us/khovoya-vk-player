import { useEffect, useRef, useState } from 'react'
import { useUi } from '../store/ui'
import * as I from './icons'
import { TAGS } from './searchTags'

export const searchRef: { current: HTMLInputElement | null } = { current: null }

/**
 * Верх телефонного окна: строка поиска всегда на месте, справа аватар.
 * Кнопок окна нет — окна на телефоне нет.
 */
export function PhoneHeader({ onLogout }: { onLogout: () => void }) {
  const tab = useUi((s) => s.tab)
  const query = useUi((s) => s.query)
  const session = useUi((s) => s.session)
  const [menu, setMenu] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const onSearch = tab === 'search'
  useEffect(() => { searchRef.current = input.current })
  useEffect(() => { if (onSearch && !query) input.current?.focus() }, [onSearch])

  return (
    <div className={'phead' + (onSearch ? ' search' : '')}>
      <div className="prow">
        {onSearch && <button className="pic" onClick={() => useUi.getState().back()} aria-label="Назад"><I.IBack size={20} /></button>}
        <div className="pfield" onClick={() => { if (!onSearch) useUi.getState().go('search') }}>
          <I.ISearch size={18} />
          <input ref={input} placeholder="Поиск" value={query} enterKeyHint="search" readOnly={!onSearch}
            onChange={(e) => useUi.getState().setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { useUi.getState().submit(); input.current?.blur() } }} />
          {onSearch && query && <button onClick={() => useUi.getState().setQuery('')} aria-label="Очистить"><I.IX size={16} /></button>}
        </div>
        {!onSearch && (
          <button className="avatar" onClick={() => setMenu(!menu)} aria-label={session?.userName ?? 'Профиль'}>
            {session?.avatar ? <img src={session.avatar} alt="" /> : (session?.userName?.[0] ?? 'Х')}
          </button>
        )}
      </div>

      {onSearch && !query && <div className="ptags">{TAGS.slice(0, 10).map((t) => <span key={t} className="tag" onClick={() => useUi.getState().submit(t)}>#{t}</span>)}</div>}

      {menu && (
        <>
          <div className="pscrim" onClick={() => setMenu(false)} />
          <div className="pmenu">
            <div className="lbl">{session?.userName}</div>
            <button onClick={() => { setMenu(false); useUi.getState().go('settings') }}>Настройки</button>
            <button onClick={() => { setMenu(false); useUi.getState().go('history') }}>История</button>
            <div className="sep" />
            <button onClick={() => { setMenu(false); onLogout() }}>Выйти из ВК</button>
          </div>
        </>
      )}
    </div>
  )
}
