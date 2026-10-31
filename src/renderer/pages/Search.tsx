import { useEffect, useState } from 'react'
import type { Playlist, Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { Crates } from '../ui/Crates'
import { SrcBadge } from '../ui/TrackRow'
import { Cover } from '../ui/Cover'
import { KEYWORDS, TAGS, withKeyword, activeKeyword } from '../ui/searchTags'
import { mergeSources } from '../ui/mergeSearch'
import { ScLink, isScUrl } from './ScLink'

type Where = 'all' | 'vk' | 'sc'

/** Ссылка SoundCloud — открываем её, иначе обычный поиск. */
export function Search() {
  const q = useUi((s) => s.submitted)
  return isScUrl(q) ? <ScLink url={q} /> : <SearchResults q={q} />
}

function SearchResults({ q }: { q: string }) {
  const [res, setRes] = useState<{ tracks: Track[]; playlists: Playlist[] } | null>(null)
  const [err, setErr] = useState('')
  const [byDate, setByDate] = useState(false)
  const [sc, setSc] = useState<Track[] | null>(null)
  const [scErr, setScErr] = useState('')
  const where = useUi((s) => s.searchWhere)
  const [noMixes, setNoMixes] = useState(localStorage.getItem('noMixes') === '1')
  const toggleNoMixes = () => { localStorage.setItem('noMixes', noMixes ? '0' : '1'); setNoMixes(!noMixes) }
  const pickWhere = (w: Where) => useUi.getState().setSearchWhere(w)
  const kw = activeKeyword(q)
  useEffect(() => {
    if (!q) return
    let alive = true
    setRes(null); setErr('')
    window.api.invoke<{ tracks: Track[]; playlists: Playlist[] }>('vk:search', q, 0, byDate)
      .then((r) => alive && setRes(r)).catch((e) => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [q, byDate])
  useEffect(() => { // SoundCloud ищем параллельно; не ответил — просто показываем ВК
    if (!q) return
    let alive = true
    setSc(null); setScErr('')
    window.api.invoke<Track[]>('sc:search', q).then((r) => alive && setSc(byDate ? [...r].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)) : r)).catch((e) => { if (alive) { setSc([]); setScErr((e as Error).message) } })
    return () => { alive = false }
  }, [q, byDate])
  const vkTracks = res?.tracks ?? []
  const scTracks = sc ?? []
  const merged = where === 'vk' ? vkTracks : where === 'sc' ? scTracks : mergeSources(vkTracks, scTracks)
  const tracks = noMixes ? merged.filter((t) => !t.duration || t.duration <= 15 * 60) : merged // без часовых диджей-сетов
  // артисты из выдачи: у каждого значок, откуда он — ВК или SoundCloud
  const artists = res ? [...new Map(tracks.map((t) => [t.artist.toLowerCase() + '|' + (t.src ?? 'vk'), { name: t.artist, src: (t.src === 'sc' ? 'sc' : 'vk') as 'vk' | 'sc', cover: t.coverUrl, id: t.id }])).values()].slice(0, 10) : []
  return (
    <div className="page fill">
      <div className="ph"><h1>«{q}»</h1>{res && <span className="cnt">{tracks.length} треков</span>}<span className="sp" />
        <div className="seg src">
          <button className={where === 'all' ? 'on' : ''} onClick={() => pickWhere('all')}>Везде</button>
          <button className={where === 'vk' ? 'on' : ''} onClick={() => pickWhere('vk')}><SrcBadge src="vk" />{res ? vkTracks.length : '…'}</button>
          <button className={where === 'sc' ? 'on' : ''} onClick={() => pickWhere('sc')}><SrcBadge src="sc" />{scErr ? '—' : sc ? scTracks.length : '…'}</button>
        </div>
      </div>
      <div className="tags" style={{ marginBottom: 14 }}>
        <span className={'tag' + (!kw ? ' on' : '')} onClick={() => useUi.getState().submit(withKeyword(q, null))}>Все</span>
        {KEYWORDS.map((k) => <span key={k.q} className={'tag' + (kw === k.q ? ' on' : '')} onClick={() => useUi.getState().submit(withKeyword(q, kw === k.q ? null : k.q))}>{k.label}</span>)}
        <span className="tag-sep" />
        <span className={'tag' + (byDate ? ' on' : '')} onClick={() => setByDate(!byDate)}>Сначала новые</span>
        <span className={'tag' + (noMixes ? ' on' : '')} title="Убрать треки длиннее 15 минут (диджей-сеты, миксы)" onClick={toggleNoMixes}>Без миксов</span>
      </div>
      {err && <div className="empty-state">{err}</div>}
      {scErr && where !== 'vk' && <div className="scdown"><SrcBadge src="sc" />{scErr}</div>}
      {!res && !err && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}
      {res && <>
        {artists.length > 1 && <div className="artists">{artists.map((a) => (
          <button key={a.name + a.src} className={a.src} title={a.src === 'sc' ? 'Артист SoundCloud' : 'Артист ВКонтакте'}
            onClick={() => { if (a.src === 'sc') useUi.getState().setSearchWhere('sc'); useUi.getState().submit(a.name) }}>
            <Cover className="av" url={a.cover} seed={a.id} /><SrcBadge src={a.src} />{a.name}
          </button>))}</div>}
        {where !== 'sc' && res.playlists.length > 0 && <><div className="h"><h3>Плейлисты</h3></div><Crates list={res.playlists} /><div style={{ height: 16 }} /></>}
        <div className="h"><h3>Треки</h3></div>
        {!tracks.length && <div className="tags" style={{ marginBottom: 12 }}>{TAGS.slice(0, 8).map((t) => <span key={t} className="tag" onClick={() => useUi.getState().submit(t)}>#{t}</span>)}</div>}
        {tracks.length ? <VirtualTrackList tracks={tracks} showSrc onPlay={(t) => void player.getState().playList(tracks, t.id, `search:${q}`)} /> : <div className="empty-state">{where === 'sc' && sc === null ? 'Ищу в SoundCloud…' : where === 'sc' && scErr ? 'В SoundCloud сейчас не поискать — нужен VPN' : 'Ничего не нашлось'}</div>}
      </>}
    </div>
  )
}
