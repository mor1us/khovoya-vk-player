import { rememberPlaylist } from '../store/sourceNav'
import { ask, confirmAsk } from '../ui/Dialog'
import { useEffect, useMemo, useState } from 'react'
import type { Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { usePlTracks, loadPlaylistTracks, reorderInPlaylist, renamePlaylist, deletePlaylist } from '../store/playlists'
import { useDownloads } from '../store/downloads'
import { player } from '../store/playerInstance'
import { Cover } from '../ui/Cover'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { fmtTotal, plural } from '../ui/format'
import { playPlaylist } from '../ui/Crates'
import * as I from '../ui/icons'

type Sort = 'default' | 'title' | 'artist' | 'added'

export function PlaylistPage() {
  const ref = useUi((s) => s.playlist)
  const p = useLibrary((s) => s.playlists.find((x) => x.id === ref?.id && x.ownerId === ref?.ownerId)) ?? ref
  const tracks = usePlTracks((s) => (p ? s.byId[p.id] : undefined))
  const loading = usePlTracks((s) => (p ? s.loading[p.id] : false))
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('default')
  const [err, setErr] = useState('')
  useEffect(() => { if (p) loadPlaylistTracks(p).catch((e) => setErr((e as Error).message)) }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let l: Track[] = tracks ?? []
    const s = q.trim().toLowerCase()
    if (s) l = l.filter((t) => (t.artist + ' ' + t.title).toLowerCase().includes(s))
    const cmp = { title: (a: Track, b: Track) => a.title.localeCompare(b.title, 'ru'), artist: (a: Track, b: Track) => a.artist.localeCompare(b.artist, 'ru'), added: (a: Track, b: Track) => (b.addedAt ?? 0) - (a.addedAt ?? 0) }
    if (sort !== 'default') l = [...l].sort(cmp[sort])
    return l
  }, [tracks, q, sort])

  if (!p) return <div className="page"><div className="empty-state">Плейлист не найден</div></div>
  const total = (tracks ?? []).reduce((a, t) => a + t.duration, 0)
  const canReorder = p.isMine && !q && sort === 'default'

  async function edit() {
    const name = await ask('Название плейлиста', p!.title, 'Сохранить')
    if (name?.trim() && name.trim() !== p!.title) await renamePlaylist(p!, name.trim())
  }
  async function remove() {
    if (await confirmAsk(`Удалить плейлист «${p!.title}»?`, 'Удалить', true)) { await deletePlaylist(p!); useUi.getState().go('playlists') }
  }

  return (
    <div className="page fill">
      <button className="back" onClick={() => useUi.getState().back()}><I.IBack size={16} />Назад</button>
      <div className="plhead">
        <Cover className="big" url={p.coverUrls[0]} seed={'pl' + p.id} />
        <div className="info">
          <span className="k">{p.isMine ? 'Твой плейлист' : 'Плейлист'}</span>
          <h1 title={p.title}>{p.title}</h1>
          <span className="meta">{p.count} {plural(p.count, 'трек', 'трека', 'треков')}{total ? ` · ${fmtTotal(total)}` : ''}</span>
          <div className="btns">
            <button className="btn-s g" onClick={() => void playPlaylist(p)}><I.IPlay size={14} />Играть</button>
            <button className="btn-s" onClick={() => void playPlaylist(p, true)}><I.IShuffle size={14} />Перемешать</button>
            <button className="btn-s" onClick={() => tracks && void useDownloads.getState().start(tracks)}><I.IDown size={14} />Скачать всё</button>
            {p.isMine && <button className="btn-s" onClick={() => void edit()}>Переименовать</button>}
            {p.isMine && <button className="btn-s" onClick={() => void remove()}>Удалить</button>}
          </div>
        </div>
      </div>
      <div className="ph" style={{ marginBottom: 10 }}>
        <input className="filter" placeholder="Поиск в плейлисте" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="filter" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="default">Как в ВК</option><option value="added">По дате добавления</option><option value="title">По названию</option><option value="artist">По артисту</option>
        </select>
        {p.isMine && <span className="hint">{canReorder ? 'Перетаскивай треки, чтобы поменять порядок' : 'Порядок меняется только при сортировке «Как в ВК»'}</span>}
      </div>
      {err && <div className="empty-state">{err}</div>}
      {loading && !tracks && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}
      {tracks && (list.length
        ? <VirtualTrackList tracks={list} ctxPlaylist={p} onPlay={(t) => { rememberPlaylist(p); void player.getState().playList(list, t.id, `pl:${p.title}`) }} onReorder={canReorder ? (id, to) => void reorderInPlaylist(p, id, to) : undefined} />
        : <div className="empty-state">{q ? 'Ничего не нашлось' : 'В плейлисте пока пусто. Перетащи сюда треки или добавь через меню «…»'}</div>)}
    </div>
  )
}
