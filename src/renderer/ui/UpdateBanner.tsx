import { useUpdates } from '../store/updates'
import { updateText } from '../../shared/updates'

export function UpdateBanner() {
  const s = useUpdates((x) => x.s)
  const hidden = useUpdates((x) => x.hidden)
  if (hidden || !['available', 'downloading', 'ready'].includes(s.status)) return null
  return (
    <div className="updbar">
      <span>{updateText(s)}</span>
      {s.status === 'available' && <button className="btn-s g" onClick={() => void window.api.invoke('upd:download')}>Скачать</button>}
      {s.status === 'downloading' && <div className="prog" style={{ width: 120 }}><i style={{ width: `${Math.round((s.progress ?? 0) * 100)}%` }} /></div>}
      {s.status === 'ready' && <button className="btn-s g" onClick={() => void window.api.invoke('upd:install')}>Перезапустить и обновить</button>}
      {s.status !== 'downloading' && <button className="ic" title="Позже" onClick={() => useUpdates.getState().hide()}>✕</button>}
    </div>
  )
}
