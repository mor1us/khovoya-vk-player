import { ask } from '../ui/Dialog'
import { useState } from 'react'
import { useLibrary } from '../store/library'
import { usePlayer, player } from '../store/playerInstance'
import { createPlaylistWith } from '../store/playlists'
import { useUi } from '../store/ui'
import { Crate } from '../ui/Crates'
import * as I from '../ui/icons'

export function Playlists() {
  const all = useLibrary((s) => s.playlists)
  const hasQueue = usePlayer((s) => (s.queue?.list().length ?? 0) > 0)
  const [which, setWhich] = useState<'mine' | 'followed'>('mine')
  const list = all.filter((p) => (which === 'mine' ? p.isMine : !p.isMine))
  async function create() {
    const name = await ask('Новый плейлист', '', 'Создать')
    if (name?.trim()) { const p = await createPlaylistWith(name.trim(), []); if (p) useUi.getState().openPlaylist(p) }
  }
  async function saveQueue() {
    const q = player.getState().queue?.list().filter((t) => t.available) ?? []
    const name = await ask('Сохранить очередь как плейлист', 'Моя очередь', 'Сохранить')
    if (name?.trim() && q.length) { const p = await createPlaylistWith(name.trim(), q); if (p) useUi.getState().toast(`Сохранено ${q.length} треков в «${p.title}»`) }
  }
  return (
    <div className="page">
      <div className="ph">
        <h1>Плейлисты</h1>
        <div className="seg"><button className={which === 'mine' ? 'on' : ''} onClick={() => setWhich('mine')}>Мои</button><button className={which === 'followed' ? 'on' : ''} onClick={() => setWhich('followed')}>Добавленные</button></div>
        <span className="sp" />
        {hasQueue && <button className="btn-s" onClick={() => void saveQueue()}>Сохранить очередь как плейлист</button>}
        <button className="btn-s g" onClick={() => void create()}><I.IPlus size={14} />Новый</button>
      </div>
      {list.length ? <div className="grid">{list.map((p) => <Crate key={`${p.ownerId}_${p.id}`} p={p} />)}</div>
        : <div className="empty-state">{which === 'mine' ? 'Создай первый плейлист кнопкой «Новый»' : 'Добавленных плейлистов нет'}</div>}
    </div>
  )
}
