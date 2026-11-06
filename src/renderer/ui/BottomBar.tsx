import { useUi, type Tab } from '../store/ui'
import * as I from './icons'

/** Нижняя панель вместо верхних вкладок: четыре раздела, до каждого достаёт большой палец. */
const TABS: [Tab, string, (p: { size?: number }) => JSX.Element][] = [
  ['home', 'Главная', I.IPlay],
  ['mine', 'Моё', I.IHeart],
  ['search', 'Поиск', I.ISearch],
  ['playlists', 'Плейлисты', I.IList]
]

export function BottomBar() {
  const tab = useUi((s) => s.tab)
  // страница плейлиста и очередь — это всё ещё «Плейлисты» и «Главная», подсветку не теряем
  const active = (t: Tab) => tab === t || (t === 'playlists' && tab === 'playlist') || (t === 'home' && (tab === 'queue' || tab === 'history' || tab === 'similar'))
  return (
    <nav className="pbar">
      {TABS.map(([t, label, Icon]) => (
        <button key={t} className={active(t) ? 'on' : ''} onClick={() => useUi.getState().go(t)}>
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
