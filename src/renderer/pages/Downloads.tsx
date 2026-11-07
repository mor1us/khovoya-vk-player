import { useEffect } from 'react'
import type { DownloadJob, Track } from '../../shared/types'
import { useDownloads } from '../store/downloads'
import { Cover } from '../ui/Cover'
import { player } from '../store/playerInstance'
import * as I from '../ui/icons'

const asTrack = (j: DownloadJob): Track => ({ id: j.id, ownerId: Number(j.id.split('_')[0]) || 0, vkId: Number(j.id.split('_')[1]) || 0, title: j.title, artist: j.artist, duration: 0, url: '', available: true })
const ST: Record<DownloadJob['status'], string> = { queued: 'в очереди', active: '', done: 'скачан', error: 'ошибка', canceled: 'отменён' }

export function Downloads() {
  const jobs = useDownloads((s) => s.jobs)
  useEffect(() => { void useDownloads.getState().refresh() }, [])
  const done = jobs.filter((j) => j.status === 'done')
  const live = jobs.filter((j) => j.status !== 'done')
  const playDone = (id?: string) => { const ts = done.map(asTrack); if (ts.length) void player.getState().playList(ts, id ?? ts[0].id, 'downloads') }
  return (
    <div className="page">
      <div className="ph">
        <h1>Загрузки</h1><span className="cnt">{done.length} скачано</span><span className="sp" />
        <button className="btn-s" onClick={() => void window.api.invoke('dl:openFolder')}>Открыть папку</button>
        {done.length > 0 && <button className="btn-s g" onClick={() => playDone()}><I.IPlay size={14} />Слушать скачанное</button>}
      </div>
      {!jobs.length && <div className="empty-state">Скачанных треков пока нет.<br />Нажми ↓ у трека или «Скачать всё» в плейлисте — файлы появятся в папке «Музыка/Хвоя» и будут играть без интернета.</div>}
      {live.length > 0 && <><div className="h"><h3>Сейчас</h3></div>
        {live.map((j) => (
          <div key={j.id} className="job">
            <Cover className="cv" seed={j.id} />
            <div style={{ minWidth: 0 }}><div className="tt">{j.title}</div><div className="ar">{j.artist}</div></div>
            <div>{j.status === 'active' ? <div className="prog"><i style={{ width: `${Math.round(j.progress * 100)}%` }} /></div> : j.error ? <span className="ar">{j.error}</span> : null}</div>
            <div className={'st' + (j.status === 'error' ? ' bad' : '')}>
              {j.status === 'active' ? `${Math.round(j.progress * 100)}%` : ST[j.status]}
              {(j.status === 'active' || j.status === 'queued') && <button className="ic" title="Отменить" onClick={() => void useDownloads.getState().cancel(j.id)}><I.IX size={14} /></button>}
              {(j.status === 'error' || j.status === 'canceled') && <button className="ic" title="Повторить" onClick={() => void window.api.invoke('vk:byId', [j.id]).then((t) => useDownloads.getState().start(t))}><I.IDown size={14} /></button>}
            </div>
          </div>))}</>}
      {done.length > 0 && <><div className="h" style={{ marginTop: 18 }}><h3>Скачано</h3></div>
        {done.map((j) => (
          <div key={j.id} className="job" onDoubleClick={() => playDone(j.id)}>
            <Cover className="cv" seed={j.id} />
            <div style={{ minWidth: 0 }}><div className="tt">{j.title}</div><div className="ar">{j.artist}</div></div>
            <div className="ar" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.path}>{j.path}</div>
            <div className="st ok">
              <button className="ic" title="Играть" onClick={() => playDone(j.id)}><I.IPlay size={14} /></button>
              <button className="ic" title="Показать в папке" onClick={() => void window.api.invoke('dl:openFolder', j.id)}><I.IFolder size={15} /></button>
            </div>
          </div>))}</>}
    </div>
  )
}
