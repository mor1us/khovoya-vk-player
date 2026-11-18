import { useCallback, useEffect, useState } from 'react'
import type { ArtistInfo, Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { player } from '../store/playerInstance'
import { TrackRow, SrcBadge } from '../ui/TrackRow'
import { Cover } from '../ui/Cover'
import { artistWhy } from '../store/artistsLogic'
import * as I from '../ui/icons'
import { artistSource } from '../ui/source'
import { useLocalArtists } from '../store/localArtists'

const NO_INFO: ArtistInfo = { followed: false, can: false }

/** Экран исполнителя: его треки, новые сверху. Работает и для ВК, и для SoundCloud. */
export function Artist() {
  const a = useUi((s) => s.artist)
  const [refresh, setRefresh] = useState(0)
  if (!a) return <div className="page"><div className="empty-state">Выбери исполнителя на главной</div></div>
  return <ArtistProfile key={artistSource(a) + ':' + refresh} a={a} refresh={() => setRefresh((n) => n + 1)} />
}

function ArtistProfile({ a, refresh }: { a: NonNullable<ReturnType<typeof useUi.getState>['artist']>; refresh: () => void }) {
  const mine = useLibrary((s) => s.mine)
  const localFollowed = useLocalArtists((s) => s.has({ source: a.src === 'sc' ? 'sc' : 'vk', id: a.id, name: a.name }))
  const [list, setList] = useState<Track[] | null>(null)
  const [info, setInfo] = useState<ArtistInfo>(NO_INFO)
  const [infoFailed, setInfoFailed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [moreBusy, setMoreBusy] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [now] = useState(() => Date.now())
  const sc = a?.src === 'sc'
  const pageSize = sc ? 40 : 30
  const searchArtist = useCallback(() => {
    const ui = useUi.getState()
    ui.setSearchWhere(sc ? 'sc' : 'vk')
    ui.submit(a.name)
  }, [a.name, sc])

  const load = useCallback(() => {
    let alive = true
    const tracks = sc ? window.api.invoke('sc:artistTracks', a.name, a.id) : window.api.invoke('vk:artistTracks', { id: a.id, name: a.name })
    tracks.then((r) => {
      if (!alive) return
      setList(r)
      setOffset(r.length)
      setHasMore(r.length === pageSize)
    }).catch(() => { if (alive) { setList([]); setFailed(true) } })
    const about = sc ? window.api.invoke('scacc:artistInfo', a.name, a.id) : window.api.invoke('vk:artistInfo', { id: a.id, name: a.name })
    about.then((r) => {
      if (!alive) return
      setInfo(r)
      if (r.missing && !a.link) useUi.getState().toast(`Профиль «${a.name}» не найден. Поискать треки?`, { label: 'Искать', run: searchArtist, dismissLabel: 'Не сейчас' })
    }).catch(() => { if (alive) setInfoFailed(true) })
    return () => { alive = false }
  }, [a, sc, searchArtist, pageSize])
  useEffect(load, [load])


  const own = new Set(mine.map((t) => t.id))
  const can = list?.filter((t) => t.available) ?? []
  const source = artistSource({ ...a, id: info.id ?? a.id })
  const profileLink = info.link ?? a.link
  const openProfile = async () => {
    if (!profileLink || profileOpen) return
    setProfileOpen(true)
    try {
      if (sc) await window.api.invoke('scacc:openArtistProfile', profileLink)
      else await window.api.invoke('vk:openArtistProfile', profileLink)
      if (useUi.getState().artist === a && useUi.getState().tab === 'artist') refresh()
    } catch (e) { useUi.getState().toast((e as Error).message) }
    finally { setProfileOpen(false) }
  }
  const play = (id: string) => void player.getState().playList(can, id, source)
  const loadMore = async () => {
    if (moreBusy || !list || !hasMore) return
    const id = info.id ?? a.id
    setMoreBusy(true)
    try {
      const next = sc
        ? await window.api.invoke('sc:artistTracks', a.name, id, offset)
        : await window.api.invoke('vk:artistTracks', { id: a.id, name: a.name }, offset)
      const seen = new Set(list.map((t) => t.id))
      const added = next.filter((t) => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
      setList([...list, ...added])
      setOffset(offset + next.length)
      setHasMore(next.length === pageSize && added.length > 0)
    } catch {
      useUi.getState().toast('Не удалось загрузить ещё треки. Попробуй снова')
    } finally { setMoreBusy(false) }
  }
  const follow = () => {
    if (busy) return
    setBusy(true)
    const added = useLocalArtists.getState().toggle({ id: info.id ?? a.id ?? '', name: a.name, cover: info.cover ?? a.cover, link: profileLink, source: sc ? 'sc' : 'vk' })
    useUi.getState().toast(added ? `Добавлен в подписки Хвои: ${a.name}` : `Удалён из подписок Хвои: ${a.name}`)
    setBusy(false)
  }

  return (
    <div className="page artist-page">
      <button className="back" onClick={() => useUi.getState().back()}><I.IBack size={16} />Назад</button>
      <div className="artist-hero">
        <Cover className="artist-cover" url={info.cover ?? a.cover} seed={a.name} />
        <div className="artist-main">
          <div className="artist-eyebrow"><SrcBadge src={sc ? 'sc' : 'vk'} />ИСПОЛНИТЕЛЬ</div>
          <h1>{a.name}</h1>
          <div className="artist-meta">
            {list && <span>Треков в списке: {list.length}</span>}
            {info.followers != null && <span>{info.followers.toLocaleString('ru-RU')} подписчиков на платформе</span>}
            {infoFailed && <span className="artist-muted">Не удалось загрузить сведения профиля</span>}
            {info.missing && !profileLink && <span className="artist-muted">Профиль артиста не найден</span>}
          </div>
          <div className="artist-actions">
            {info.missing && <button className="btn-s" onClick={searchArtist}>Искать треки</button>}
            {!!can.length && <button className="btn-s g" onClick={() => play(can[0].id)}><I.IPlay size={14} />Слушать</button>}
            {(!info.missing || profileLink) && <button className={'btn-s' + (sc ? ' sco' : '')} disabled={busy} onClick={follow}>
              <I.IHeart size={14} on={localFollowed} />{busy ? 'Сохраняю…' : localFollowed ? 'Отписаться в Хвое' : 'Подписаться в Хвое'}
            </button>}
            {profileLink && <button className="btn-s" disabled={profileOpen} onClick={() => void openProfile()}><I.IExternal size={14} />{sc ? 'Открыть профиль' : 'Открыть в ВК'}</button>}
            <button className="btn-s" title="Загрузить заново" onClick={refresh} disabled={list === null || busy}><I.IRefresh size={14} />Обновить</button>
          </div>
        </div>
      </div>
      {list === null && <div className="rows">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}</div>}
      {list?.length === 0 && <div className="empty-state">{failed ? (sc ? 'SoundCloud не ответил. Попробуй ещё раз чуть позже' : 'ВК не ответил. Попробуй ещё раз чуть позже') : `У ${a.name} тут ничего не нашлось`}</div>}
      {!!list?.length && <div className="rows">{list.map((t, i) => <TrackRow key={t.id} track={t} why={artistWhy(t, own, now)} index={i} onPlay={() => play(t.id)} />)}</div>}
      {hasMore && (!sc || a.id || info.id) && <button className="btn-s" disabled={moreBusy} onClick={() => void loadMore()}>{moreBusy ? 'Загружаю…' : 'Показать ещё'}</button>}
    </div>
  )
}
