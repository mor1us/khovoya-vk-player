import { useEffect, useRef, useState } from 'react'
import { useUi, type Tab } from '../store/ui'
import * as I from './icons'
import { TAGS } from './searchTags'
import { useSuggest, type Suggest } from './searchSuggest'
import { Cover } from './Cover'
import { SrcBadge } from './TrackRow'
import { player } from '../store/playerInstance'
import { readJson } from '../store/json'

const TABS: [Tab, string][] = [['home', 'Главная'], ['mine', 'Моё'], ['playlists', 'Плейлисты'], ['downloads', 'Загрузки'], ['soundcloud', 'SoundCloud']]
export const searchRef: { current: HTMLInputElement | null } = { current: null }

const fmtFollowers = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} млн` : n >= 1e3 ? `${Math.round(n / 1e3)} тыс.` : String(n)) + ' подписчиков'

/** Совпавшую часть подсказки выделяем цветом. */
function hl(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.trim().toLowerCase())
  if (i < 0 || !q.trim()) return <b>{text}</b>
  const n = q.trim().length
  return <>{text.slice(0, i)}<b className="m">{text.slice(i, i + n)}</b><b>{text.slice(i + n)}</b></>
}

export function TopBar({ onLogout }: { onLogout: () => void }) {
  const tab = useUi((s) => s.tab)
  const query = useUi((s) => s.query)
  const session = useUi((s) => s.session)
  const [menu, setMenu] = useState(false)
  const [focus, setFocus] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { searchRef.current = input.current }, [])
  const hist = focus && !query ? readJson<string[]>('searchHistory', []) : []
  const items = useSuggest(query, focus)
  const [act, setAct] = useState(0)
  useEffect(() => { setAct(0) }, [query])
  const pick = (it: Suggest) => {
    if (it.kind === 'search') useUi.getState().submit(query)
    else if (it.kind === 'artist') { if (it.src === 'sc') useUi.getState().setSearchWhere('sc'); useUi.getState().submit(it.name) }
    else if (it.kind === 'query') useUi.getState().submit(it.q)
    else void player.getState().playList([it.track], it.track.id, `search:${query.trim()}`)
    input.current?.blur()
  }
  const active = (t: Tab) => tab === t || (t === 'playlists' && tab === 'playlist')
  return (
    <div className="bar drag">
      <nav className="tabs nodrag">{TABS.map(([t, l]) => <button key={t} className={(active(t) ? 'on' : '') + (t === 'soundcloud' ? ' sc' : '')} onClick={() => useUi.getState().go(t)}>{l}</button>)}</nav>
      <div className={'search nodrag' + (query ? ' filled' : '')} style={{ position: 'relative' }} title={focus || query ? undefined : 'Поиск'}
        onMouseDown={(e) => { if (e.target === e.currentTarget || !(e.target as HTMLElement).closest('input,button,.menu')) { e.preventDefault(); input.current?.focus() } }}>
        <I.ISearch size={17} />
        <input ref={input} placeholder="Найти…" value={query}
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onChange={(e) => useUi.getState().setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setAct((act + 1) % items.length) }
            else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setAct((act - 1 + items.length) % items.length) }
            else if (e.key === 'Enter') { if (items[act]) pick(items[act]); else { useUi.getState().submit(); input.current?.blur() } }
            else if (e.key === 'Escape') input.current?.blur()
          }} />
        {query && <button onClick={() => useUi.getState().setQuery('')} title="Очистить"><I.IX size={14} /></button>}
        {focus && query.trim() && items.length > 0 && (
          <div className="sugg">
            {items.map((it, i) => (
              <button key={i} className={'sg ' + it.kind + (i === act ? ' act' : '')} onMouseEnter={() => setAct(i)} onMouseDown={(e) => { e.preventDefault(); pick(it) }}>
                {it.kind === 'search' && <><span className="ico"><I.ISearch size={15} /></span><span className="tx">Искать <b>«{it.q}»</b></span><kbd>Enter</kbd></>}
                {it.kind === 'artist' && <><Cover className="av" url={it.cover} seed={it.seed} /><span className="tx"><b><SrcBadge src={it.src} />{it.name}</b><small>{it.src === 'sc' ? `Артист SoundCloud${it.followers ? ` · ${fmtFollowers(it.followers)}` : ''}` : 'Артист ВКонтакте'}</small></span><span className="ico r"><I.IUser size={15} /></span></>}
                {it.kind === 'track' && <><Cover className="cv" url={it.track.coverUrl} seed={it.track.id} /><span className="tx"><b><SrcBadge src={it.track.src === 'sc' ? 'sc' : 'vk'} />{it.track.title}</b><small>{it.track.artist}</small></span><span className="ico r"><I.IPlay size={13} /></span></>}
                {it.kind === 'query' && <><span className="ico">{it.fromHistory ? <I.IClock size={14} /> : <I.ISearch size={14} />}</span><span className="tx">{hl(it.q, query)}</span><span className="ico r fill" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); useUi.getState().setQuery(it.q + ' ') }} title="Подставить в строку"><I.IArrowUpLeft size={14} /></span></>}
              </button>
            ))}
            <div className="sgtags">{TAGS.slice(0, 8).map((t) => <span key={t} className="tag" onMouseDown={(e) => { e.preventDefault(); useUi.getState().submit(t); input.current?.blur() }}>#{t}</span>)}</div>
          </div>
        )}
        {focus && !query && (
          <div className="menu" style={{ top: 46, right: 0, width: 340 }}>
            {hist.length > 0 && <><div className="lbl">Недавние запросы</div>{hist.slice(0, 5).map((h) => <button key={h} onMouseDown={() => useUi.getState().submit(h)}>{h}</button>)}<div className="sep" /></>}
            <div className="lbl">Теги</div>
            <div className="tags">{TAGS.map((t) => <span key={t} className="tag" onMouseDown={() => useUi.getState().submit(t)}>#{t}</span>)}</div>
          </div>
        )}
      </div>
      <div className="nodrag" style={{ position: 'relative' }}>
        <button className={'avatar' + (tab === 'settings' ? ' on' : '')} onClick={() => setMenu(!menu)} title={session?.userName}>{session?.avatar ? <img src={session.avatar} alt="" /> : (session?.userName?.[0] ?? 'Х')}</button>
        {menu && (
          <div className="menu" style={{ right: 0, top: 40 }} onMouseLeave={() => setMenu(false)}>
            <div className="lbl">{session?.userName}</div>
            <button onClick={() => { setMenu(false); useUi.getState().go('settings') }}>Настройки</button>
            <div className="sep" />
            <button onClick={() => { setMenu(false); useUi.getState().go('history') }}>История</button>
            <button onClick={() => { setMenu(false); useUi.getState().go('similar') }}>Похожее</button>
            <button onClick={() => { setMenu(false); useUi.getState().go('disliked') }}>Не нравится</button>
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
