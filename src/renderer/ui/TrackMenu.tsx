import { ask } from './Dialog'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { Playlist, Track } from '../../shared/types'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { useDownloads } from '../store/downloads'
import { player } from '../store/playerInstance'
import { addToPlaylist, createPlaylistWith } from '../store/playlists'

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
  useEffect(() => { setSub(false); if (!m) return; const close = () => useMenu.getState().open(null); window.addEventListener('click', close); window.addEventListener('blur', close); return () => { window.removeEventListener('click', close); window.removeEventListener('blur', close) } }, [m])
  if (!m) return null
  const { tracks } = m
  const one = tracks.length === 1 ? tracks[0] : null
  const lib = useLibrary.getState()
  const inMine = one ? lib.isMine(one.id) : false
  const toast = useUi.getState().toast
  const run = (f: () => Promise<unknown> | void) => { useMenu.getState().open(null); Promise.resolve(f()).catch((e) => toast((e as Error).message)) }
  const left = Math.min(m.x, window.innerWidth - 240), top = Math.min(m.y, window.innerHeight - 320)
  return (
    <div className="menu" style={{ left, top, position: 'fixed' }} onClick={(e) => e.stopPropagation()}>
      {tracks.length > 1 && <div className="lbl">Выбрано: {tracks.length}</div>}
      <button onClick={() => run(() => player.getState().append(tracks.filter((t) => t.available)))}>В конец очереди</button>
      {one && <button onClick={() => run(async () => {
        if (inMine) { await window.api.invoke('vk:remove', one); lib.setMine(lib.mine.filter((t) => t.id !== one.id)); toast('Убрано из твоей музыки') }
        else { await window.api.invoke('vk:add', one); lib.setMine([one, ...lib.mine]); toast('Добавлено в твою музыку') }
      })}>{inMine ? 'Убрать из моей музыки' : '♥ Добавить в мою музыку'}</button>}
      <button onClick={() => setSub(!sub)}>Добавить в плейлист ›</button>
      {sub && <div style={{ paddingLeft: 10, maxHeight: 200, overflow: 'auto' }}>
        <button onClick={() => run(async () => { const name = await ask('Новый плейлист', '', 'Создать'); if (name) await createPlaylistWith(name, tracks) })}>+ Новый плейлист</button>
        {playlists.map((p) => <button key={p.id} onClick={() => run(() => addToPlaylist(p, tracks))}>{p.title}</button>)}
      </div>}
      {m.ctxPlaylist?.isMine && <button onClick={() => run(async () => {
        const { removeFromPlaylist } = await import('../store/playlists'); await removeFromPlaylist(m.ctxPlaylist!, tracks)
      })}>Убрать из этого плейлиста</button>}
      <div className="sep" />
      <button onClick={() => run(() => useDownloads.getState().start(tracks))}>Скачать{tracks.length > 1 ? ` (${tracks.length})` : ''}</button>
      {one && <button onClick={() => run(() => useUi.getState().submit(one.artist))}>Найти ещё у «{one.artist}»</button>}
    </div>
  )
}
