import { useState } from 'react'
import type { Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { createPlaylistWith } from '../store/playlists'
import { transferToVk } from '../store/transfer'
import { useDownloads } from '../store/downloads'
import { ask } from './Dialog'
import * as I from './icons'

/** Кнопки для чужого плейлиста: сохранить в Хвою, перенести в ВК, скачать всё. */
export function PlaylistActions({ title, tracks, local = true, vk = true }: { title: string; tracks: Track[]; local?: boolean; vk?: boolean }) {
  const [prog, setProg] = useState<string | null>(null)
  const [missing, setMissing] = useState<Track[] | null>(null)
  const toast = useUi.getState().toast
  const toVk = async () => {
    const name = await ask('Название плейлиста в ВК', title, 'Перенести')
    if (!name?.trim()) return
    setProg('0'); setMissing(null)
    try {
      const r = await transferToVk(name.trim(), tracks, (d, n) => setProg(`${d}/${n}`))
      if (!r.ok) toast('В ВК не нашлось ни одного трека из этого плейлиста')
      else toast(`Готово: в ВК перенесено ${r.found.length} из ${tracks.length}`)
      setMissing(r.missing.length ? r.missing : null)
    } catch (e) { toast((e as Error).message) } finally { setProg(null) }
  }
  return (
    <>
      {local && <button className="btn-s" onClick={async () => { const p = await createPlaylistWith(title, tracks, true); if (p) useUi.getState().openPlaylist(p) }}><I.IPlus size={14} />В плейлисты Хвои</button>}
      {vk && <button className="btn-s" disabled={prog !== null || !tracks.length} title="Найдёт те же треки в ВК и соберёт из них плейлист ВК" onClick={() => void toVk()}>{prog !== null ? `Ищу в ВК… ${prog}` : 'Перенести в ВК'}</button>}
      <button className="btn-s" disabled={!tracks.length} onClick={() => void useDownloads.getState().start(tracks.filter((t) => t.available))}><I.IDown size={14} />Скачать всё</button>
      {missing && <div className="missing"><b>Не нашлось в ВК ({missing.length}):</b> {missing.slice(0, 12).map((t) => `${t.artist} — ${t.title}`).join(' · ')}{missing.length > 12 ? ' …' : ''}<button className="link" onClick={() => setMissing(null)}>Скрыть</button></div>}
    </>
  )
}
