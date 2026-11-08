import { useCallback, useEffect, useState } from 'react'
import type { ArtistInfo, Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { player } from '../store/playerInstance'
import { TrackRow, SrcBadge } from '../ui/TrackRow'
import { Cover } from '../ui/Cover'
import { artistWhy } from '../store/artistsLogic'
import * as I from '../ui/icons'

const NO_INFO: ArtistInfo = { followed: false, can: false }

/** Экран исполнителя: его треки, новые сверху. Работает и для ВК, и для SoundCloud. */
export function Artist() {
  const a = useUi((s) => s.artist)
  const mine = useLibrary((s) => s.mine)
  const [list, setList] = useState<Track[] | null>(null)
  const [info, setInfo] = useState<ArtistInfo>(NO_INFO)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const sc = a?.src === 'sc'

  const load = useCallback(() => {
    if (!a) return () => {}
    let alive = true
    setList(null); setFailed(false); setInfo(NO_INFO)
    const tracks = sc ? window.api.invoke('sc:artistTracks', a.name) : window.api.invoke('vk:artistTracks', { id: a.id, name: a.name })
    tracks.then((r) => { if (alive) setList(r) }).catch(() => { if (alive) { setList([]); setFailed(true) } })
    const about = sc ? window.api.invoke('scacc:artistInfo', a.name) : window.api.invoke('vk:artistInfo', { id: a.id, name: a.name })
    about.then((r) => { if (alive) setInfo(r) }).catch(() => {}) // подписка — дело десятое, треки важнее
    return () => { alive = false }
  }, [a, sc])
  useEffect(load, [load])

  if (!a) return <div className="page"><div className="empty-state">Выбери исполнителя на главной</div></div>

  const own = new Set(mine.map((t) => t.id))
  const now = Date.now()
  const can = list?.filter((t) => t.available) ?? []
  const play = (id: string) => void player.getState().playList(can, id, `artist:${a.name}`)
  const follow = async () => {
    setBusy(true)
    try {
      const on = !info.followed
      if (sc) await window.api.invoke('scacc:artistFollow', a.name, on)
      else await window.api.invoke('vk:artistFollow', { id: a.id, name: a.name }, on)
      setInfo({ ...info, followed: on })
      useUi.getState().toast(on ? `Подписался на ${a.name}` : `Отписался от ${a.name}`)
    } catch (e) { useUi.getState().toast((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => useUi.getState().back()}><I.IBack size={16} />Назад</button>
      <div className="ph">
        <Cover className="av" url={info.cover ?? a.cover} seed={a.name} />
        <h1><SrcBadge src={sc ? 'sc' : 'vk'} />{a.name}</h1>
        {!!list?.length && <span className="cnt">{list.length} ТРЕКОВ</span>}
        <span className="sp" />
        <button className="btn-s" title="Загрузить заново" onClick={load} disabled={list === null}><I.IRefresh size={14} />Обновить</button>
        {info.can && <button className={'btn-s' + (info.followed ? '' : ' g')} disabled={busy} onClick={() => void follow()}><I.IHeart size={14} on={info.followed} />{info.followed ? 'Не слежу' : 'Слежу'}</button>}
        {!!can.length && <button className="btn-s g" onClick={() => play(can[0].id)}><I.IPlay size={14} />Слушать</button>}
      </div>
      {list === null && <div className="rows">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}</div>}
      {list?.length === 0 && <div className="empty-state">{failed ? (sc ? 'SoundCloud не ответил. Попробуй ещё раз чуть позже' : 'ВК не ответил. Попробуй ещё раз чуть позже') : `У ${a.name} тут ничего не нашлось`}</div>}
      {!!list?.length && <div className="rows">{list.map((t, i) => <TrackRow key={t.id} track={t} why={artistWhy(t, own, now)} index={i} onPlay={() => play(t.id)} />)}</div>}
    </div>
  )
}
