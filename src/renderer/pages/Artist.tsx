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
  const [list, setList] = useState<Track[] | null>(null)
  const [info, setInfo] = useState<ArtistInfo>(NO_INFO)
  const [failed, setFailed] = useState(false)
  const [infoFailed, setInfoFailed] = useState(false)
  const [infoLoading, setInfoLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showFollowActions, setShowFollowActions] = useState(false)
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
      if (r.missing) useUi.getState().toast(`Профиль «${a.name}» не найден. Поискать треки?`, { label: 'Искать', run: searchArtist, dismissLabel: 'Не сейчас' })
    }).catch(() => { if (alive) setInfoFailed(true) }).finally(() => { if (alive) setInfoLoading(false) })
    return () => { alive = false }
  }, [a, sc, searchArtist, pageSize])
  useEffect(load, [load])


  const own = new Set(mine.map((t) => t.id))
  const can = list?.filter((t) => t.available) ?? []
  const source = artistSource({ ...a, id: info.id ?? a.id })
  const profileLink = info.link ?? a.link
  const openProfile = async () => {
    if (!profileLink || profileOpen) return
    if (!sc) { window.open(profileLink, '_blank'); return }
    setProfileOpen(true)
    try {
      await window.api.invoke('scacc:openArtistProfile', profileLink)
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
  const follow = async (on: boolean) => {
    if (busy || infoLoading || infoFailed || !info.can) return
    setBusy(true)
    setShowFollowActions(false)
    const id = info.id ?? a.id
    let sent = false
    try {
      if (sc) await window.api.invoke('scacc:artistFollow', a.name, on, id)
      else await window.api.invoke('vk:artistFollow', { id, name: a.name }, on)
      sent = true
      // не верим себе на слово: спрашиваем, что там теперь на самом деле
      const fresh = sc ? await window.api.invoke('scacc:artistInfo', a.name, id) : await window.api.invoke('vk:artistInfo', { id, name: a.name })
      setInfo(fresh)
      const who = sc ? 'SoundCloud' : 'ВК'
      if (fresh.statusUnknown || !fresh.can) useUi.getState().toast(`Запрос принят. ${who} не подтвердил состояние подписки`)
      else if (fresh.followed === on) useUi.getState().toast(on ? `Слежу за ${a.name}` : `Больше не слежу за ${a.name}`)
      else useUi.getState().toast(on ? `${who} не дал подписаться` : `${who} не дал отписаться`)
    } catch (e) {
      if (sent) setInfo((previous) => ({ ...previous, statusUnknown: true }))
      useUi.getState().toast(sent ? 'Запрос принят, но статус подписки пока не удалось проверить' : (e as Error).message,
        !sent && sc && profileLink ? { label: 'Открыть профиль', run: () => void openProfile() } : undefined)
    } finally { setBusy(false) }
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
            {info.followers != null && <span>{info.followers.toLocaleString('ru-RU')} подписчиков</span>}
            {infoFailed && <span className="artist-muted">Не удалось загрузить подписку</span>}
            {info.statusUnknown && <span className="artist-muted">Сервис не показал состояние подписки</span>}
            {info.missing && <span className="artist-muted">Профиль артиста не найден</span>}
            {!infoLoading && !infoFailed && !info.can && !info.missing && <span className="artist-muted">{sc ? 'Войди в SoundCloud, чтобы подписаться' : 'Подписка ВК недоступна для этой страницы'}</span>}
          </div>
          <div className="artist-actions">
            {info.missing && <button className="btn-s" onClick={searchArtist}>Искать треки</button>}
            {!!can.length && <button className="btn-s g" onClick={() => play(can[0].id)}><I.IPlay size={14} />Слушать</button>}
            {!info.missing && <button className="btn-s" disabled={busy || infoLoading || infoFailed || !info.can} aria-expanded={info.statusUnknown ? showFollowActions : undefined} onClick={() => info.statusUnknown ? setShowFollowActions((open) => !open) : void follow(!info.followed)}>
              <I.IHeart size={14} on={info.followed} />{busy ? 'Сохраняю…' : infoLoading || infoFailed || info.statusUnknown ? 'Подписка' : info.followed ? 'Отписаться' : 'Подписаться'} в {sc ? 'SoundCloud' : 'ВК'}
            </button>}
            {showFollowActions && info.statusUnknown && <>
              <button className="btn-s" onClick={() => void follow(true)}>Подписаться</button>
              <button className="btn-s" onClick={() => void follow(false)}>Отписаться</button>
            </>}
            {profileLink && <button className="btn-s" disabled={profileOpen} onClick={() => void openProfile()}><I.IExternal size={14} />Открыть профиль</button>}
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
