import { ask } from './Dialog'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { Playlist, Track } from '../../shared/types'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { useDownloads } from '../store/downloads'
import { player } from '../store/playerInstance'
import { addToPlaylist, createPlaylistWith } from '../store/playlists'
import { canOpenSource, openSource } from '../store/sourceNav'
import { sourceParts } from './source'
import { SrcBadge } from './TrackRow'
import * as I from './icons'

type M = { tracks: Track[]; x: number; y: number; ctxPlaylist?: Playlist } | null
export const useMenu = create<{ m: M; open(m: M): void }>((set) => ({ m: null, open: (m) => set({ m }) }))

export function openTrackMenu(e: React.MouseEvent, tracks: Track[], ctxPlaylist?: Playlist) {
  e.preventDefault(); e.stopPropagation()
  useMenu.getState().open({ tracks, x: e.clientX, y: e.clientY, ctxPlaylist })
}

export function TrackMenu() {
  const m = useMenu((s) => s.m)
  const playlists = useLibrary((s) => s.playlists.filter((p) => p.isMine))
  const [sub, setSub] = useState(false)
  useEffect(() => {
    setSub(false)
    if (!m) return
    const close = () => useMenu.getState().open(null)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('click', close); window.addEventListener('blur', close); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('click', close); window.removeEventListener('blur', close); window.removeEventListener('keydown', esc) }
  }, [m])
  if (!m) return null
  const { tracks } = m
  const one = tracks.length === 1 ? tracks[0] : null
  const lib = useLibrary.getState()
  const inMine = one ? lib.isMine(one.id) : false
  const source = player.getState().source
  const isCurrent = !!one && player.getState().current?.id === one.id
  const vkOnly = tracks.every((t) => t.src !== 'sc') // в ВК можно добавить только треки ВК
  const toast = useUi.getState().toast
  const run = (f: () => Promise<unknown> | void) => { useMenu.getState().open(null); Promise.resolve(f()).catch((e) => toast((e as Error).message)) }
  const left = Math.min(m.x, window.innerWidth - 240), top = Math.min(m.y, window.innerHeight - 320)
  return (
    <div className="menu" style={{ left, top, position: 'fixed' }} onClick={(e) => e.stopPropagation()}>
      {tracks.length > 1 && <div className="lbl">Выбрано: {tracks.length}</div>}
      <button onClick={() => run(() => player.getState().append(tracks.filter((t) => t.available)))}><span className="ico"><I.IQueue size={15} /></span>В конец очереди</button>
      {one && vkOnly && <button onClick={() => run(async () => {
        if (inMine) { await window.api.invoke('vk:remove', one); lib.setMine(lib.mine.filter((t) => t.id !== one.id)); toast('Убрано из твоей музыки') }
        else { await window.api.invoke('vk:add', one); lib.setMine([one, ...lib.mine]); toast('Добавлено в твою музыку') }
      })}><span className="ico"><I.IHeart size={15} on={inMine} /></span>{inMine ? 'Убрать из моей музыки' : 'Добавить в мою музыку'}</button>}
      <button onClick={() => setSub(!sub)}><span className="ico"><I.IPlus size={15} /></span>Добавить в плейлист {sub ? '⌄' : '›'}</button>
      {sub && <div className="sub">
        {vkOnly && <button onClick={() => run(async () => { const name = await ask('Новый плейлист ВК', '', 'Создать'); if (name) await createPlaylistWith(name, tracks) })}><span className="ico"><I.IPlus size={15} /></span>Новый плейлист ВК</button>}
        <button onClick={() => run(async () => { const name = await ask('Новый плейлист Хвои (ВК + SoundCloud)', '', 'Создать'); if (name) await createPlaylistWith(name, tracks, true) })}><span className="ico"><I.IPlus size={15} /></span>Новый плейлист Хвои</button>
        {playlists.filter((p) => vkOnly || p.local).map((p) => <button key={p.id} onClick={() => run(() => addToPlaylist(p, tracks))}>{p.local ? <span className="khb">ХВОЯ</span> : <span className="ico" />}{p.title}</button>)}
      </div>}
      {m.ctxPlaylist?.isMine && <button onClick={() => run(async () => {
        const { removeFromPlaylist } = await import('../store/playlists'); await removeFromPlaylist(m.ctxPlaylist!, tracks)
      })} className="bad"><span className="ico"><I.IX size={14} /></span>Убрать из этого плейлиста</button>}
      <div className="sep" />
      <button onClick={() => run(() => useDownloads.getState().start(tracks))}><span className="ico"><I.IDown size={15} /></span>Скачать{tracks.length > 1 ? ` (${tracks.length})` : ''}</button>
      {one && <button onClick={() => run(() => { useUi.getState().setSearchWhere('sc'); useUi.getState().submit(`${one.artist.split(/,|&| feat/i)[0].trim()} ${one.title.replace(/\(.*?\)|\[.*?\]/g, '').trim()} remix`) })}><span className="ico"><I.ISearch size={15} /></span>Найти ремиксы на SoundCloud</button>}
      {one?.link && <button onClick={() => run(() => { window.open(one.link, '_blank') })}><span className="ico"><SrcBadge src="sc" /></span>Открыть на SoundCloud</button>}
      {one?.album && <button onClick={() => run(() => useUi.getState().openPlaylist({ id: one.album!.id, ownerId: one.album!.ownerId, accessKey: one.album!.accessKey, title: one.album!.title, count: 0, coverUrls: one.coverUrl ? [one.coverUrl] : [], isMine: false, updatedAt: 0 }))}><span className="ico"><I.IList size={15} /></span>Перейти к альбому «{one.album.title}»</button>}
      {one && isCurrent && canOpenSource(source) && <button onClick={() => run(() => openSource(source))}><span className="ico"><I.IBack size={15} /></span>Перейти туда, откуда играет: {sourceParts(source).name}</button>}
      {one && <button onClick={() => run(() => useUi.getState().submit(one.artist))}><span className="ico"><I.IUser size={15} /></span>Найти ещё у «{one.artist}»</button>}
    </div>
  )
}
