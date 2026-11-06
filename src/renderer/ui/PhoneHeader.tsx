import { useEffect, useRef, useState } from 'react'
import { useUi } from '../store/ui'
import * as I from './icons'
import { TAGS } from './searchTags'

export const searchRef: { current: HTMLInputElement | null } = { current: null }

/**
 * Верх телефонного окна: на обычных экранах — название и аватар,
 * на поиске — строка во всю ширину. Кнопок окна нет: окна на телефоне нет.
 */
export function PhoneHeader({ onLogout }: { onLogout: () => void }) {
  const tab = useUi((s) => s.tab)
  const query = useUi((s) => s.query)
  const session = useUi((s) => s.session)
  const [menu, setMenu] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { searchRef.current = input.current }, [tab])
  useEffect(() => { if (tab === 'search' && !query) input.current?.focus() }, [tab])

  if (tab === 'search') return (
    <div className="phead search">
      <div className="pfield">
        <I.ISearch size={18} />
        <input ref={input} placeholder="Найти музыку…" value={query} enterKeyHint="search"
          onChange={(e) => useUi.getState().setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { useUi.getState().submit(); input.current?.blur() } }} />
        {query && <button onClick={() => useUi.getState().setQuery('')} aria-label="Очистить"><I.IX size={16} /></button>}
      </div>
      {!query && <div className="ptags">{TAGS.slice(0, 10).map((t) => <span key={t} className="tag" onClick={() => useUi.getState().submit(t)}>#{t}</span>)}</div>}
    </div>
  )

  return (
    <div className="phead">
      <div className="brand"><i />ХВОЯ</div>
      <button className="pic" onClick={() => useUi.getState().go('history')} aria-label="История"><I.IClock size={20} /></button>
      <button className="avatar" onClick={() => setMenu(!menu)} aria-label={session?.userName ?? 'Профиль'}>
        {session?.avatar ? <img src={session.avatar} alt="" /> : (session?.userName?.[0] ?? 'Х')}
      </button>
      {menu && (
        <>
          <div className="pscrim" onClick={() => setMenu(false)} />
          <div className="pmenu">
            <div className="lbl">{session?.userName}</div>
            <button onClick={() => { setMenu(false); useUi.getState().go('settings') }}>Настройки</button>
            <div className="sep" />
            <button onClick={() => { setMenu(false); onLogout() }}>Выйти из ВК</button>
          </div>
        </>
      )}
    </div>
  )
}
